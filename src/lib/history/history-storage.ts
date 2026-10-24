import { writeFailureReason, type DraftStorage } from "@/lib/drafts/draft-storage";
import { parseBillingDocumentDraft, parseReceiptDraft } from "@/lib/drafts/draft-shapes";
import {
  HISTORY_KINDS,
  summarize,
  type HistoryDocument,
  type HistoryKind,
  type HistoryRecord,
  type HistorySummary,
} from "@/lib/history/history";
import { isValidLogoDataUrl } from "@/lib/profile/logo";

/**
 * DOCUMENT HISTORY — browser storage
 * ══════════════════════════════════
 * Saved only in this browser's localStorage. Not uploaded, not synced, not encrypted.
 *
 * Layout (separate from drafts and the business profile, which are never touched):
 *   smartbill.history.v1.doc.<id>     → { version: 1, id, kind, savedAt, summary, values, logo }
 *   smartbill.history.v1.logo.<hash>  → { version: 1, dataUrl }
 *
 * One key per record, so a damaged record affects only itself and saving never rewrites
 * other records. An invoice logo (up to ~150 KB) is stored once and shared by every
 * record that uses it; the record keeps only a reference. A logo no record uses any more
 * is removed when a record is deleted.
 *
 * Every function here reports problems as results; none of them throws.
 */
export const HISTORY_VERSION = 1;
const PREFIX = `smartbill.history.v${HISTORY_VERSION}.`;
const DOC_PREFIX = `${PREFIX}doc.`;
const LOGO_PREFIX = `${PREFIX}logo.`;

export const historyRecordKey = (id: string) => `${DOC_PREFIX}${id}`;
export const historyLogoKey = (ref: string) => `${LOGO_PREFIX}${ref}`;

const ID_PATTERN = /^[a-z0-9-]{8,40}$/;
const LOGO_REF_PATTERN = /^[a-f0-9]{8}(-\d{1,3})?$/;

/* ───────────── reading ───────────── */

export type HistoryListResult =
  { status: "loaded"; records: HistoryRecord[]; damagedIds: string[] } | { status: "unavailable" };

/** Reads every saved record. Unreadable ones are listed by id, never deleted. */
export function listHistory(storage: DraftStorage | null): HistoryListResult {
  if (!storage) return { status: "unavailable" };
  try {
    const records: HistoryRecord[] = [];
    const damagedIds: string[] = [];
    for (const key of keysWithPrefix(storage, DOC_PREFIX)) {
      const id = key.slice(DOC_PREFIX.length);
      const record = parseRecord(storage, id, storage.getItem(key));
      if (record) records.push(record);
      else damagedIds.push(id);
    }
    records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return { status: "loaded", records, damagedIds };
  } catch {
    return { status: "unavailable" };
  }
}

function parseRecord(storage: DraftStorage, id: string, raw: string | null): HistoryRecord | null {
  if (raw === null || !ID_PATTERN.test(id)) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    v.version !== HISTORY_VERSION ||
    v.id !== id ||
    typeof v.kind !== "string" ||
    !(HISTORY_KINDS as readonly string[]).includes(v.kind) ||
    typeof v.savedAt !== "string" ||
    Number.isNaN(Date.parse(v.savedAt))
  ) {
    return null;
  }
  const kind = v.kind as HistoryKind;
  const summary = parseSummary(v.summary);
  if (!summary) return null;

  if (kind === "receipt") {
    if (v.logo !== null) return null;
    const values = parseReceiptDraft(v.values);
    return values ? { id, kind, savedAt: v.savedAt, summary, values } : null;
  }

  // Invoices and quotations: put the shared logo back into the values.
  let logo = "";
  if (v.logo !== null) {
    if (typeof v.logo !== "string" || !LOGO_REF_PATTERN.test(v.logo)) return null;
    const stored = readLogoEntry(storage, v.logo);
    if (stored === null) return null; // logo missing: the record cannot be shown as saved
    logo = stored;
  }
  const rawValues =
    typeof v.values === "object" && v.values !== null
      ? { ...(v.values as Record<string, unknown>), sellerLogo: logo }
      : v.values;
  const values = parseBillingDocumentDraft(rawValues, kind);
  return values ? { id, kind, savedAt: v.savedAt, summary, values } : null;
}

function parseSummary(value: unknown): HistorySummary | null {
  if (typeof value !== "object" || value === null) return null;
  const s = value as Record<string, unknown>;
  const texts = [s.documentNumber, s.customerName, s.customerPhone, s.date];
  if (!texts.every((t) => typeof t === "string" && t.length <= 300)) return null;
  if (typeof s.totalPaise !== "number" || !Number.isSafeInteger(s.totalPaise) || s.totalPaise < 0) {
    return null;
  }
  return {
    documentNumber: s.documentNumber as string,
    customerName: s.customerName as string,
    customerPhone: s.customerPhone as string,
    date: s.date as string,
    totalPaise: s.totalPaise,
  };
}

function readLogoEntry(storage: DraftStorage, ref: string): string | null {
  try {
    const raw = storage.getItem(historyLogoKey(ref));
    if (raw === null) return null;
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    return v && v.version === HISTORY_VERSION && isValidLogoDataUrl(v.dataUrl) ? v.dataUrl : null;
  } catch {
    return null;
  }
}

/* ───────────── saving ───────────── */

export type HistorySaveResult =
  | { ok: true; record: HistoryRecord }
  | { ok: false; reason: "incomplete" | "unavailable" | "quota" | "error" };

/**
 * Saves a snapshot of a finished document as a new record. Never overwrites an
 * existing record. Refuses incomplete documents (the same rule that blocks printing).
 */
export function saveToHistory(
  storage: DraftStorage | null,
  doc: HistoryDocument,
  now: Date = new Date(),
): HistorySaveResult {
  const summary = summarize(doc);
  if (!summary) return { ok: false, reason: "incomplete" };
  if (!storage) return { ok: false, reason: "unavailable" };

  const id = newRecordId(storage, now);
  const savedAt = now.toISOString();
  let logoRef: string | null = null;
  let storedValues: unknown = doc.values;

  try {
    if (doc.kind !== "receipt") {
      const { sellerLogo, ...rest } = doc.values;
      storedValues = { ...rest, sellerLogo: "" };
      if (sellerLogo !== "") {
        logoRef = storeLogo(storage, sellerLogo);
      }
    }
    storage.setItem(
      historyRecordKey(id),
      JSON.stringify({
        version: HISTORY_VERSION,
        id,
        kind: doc.kind,
        savedAt,
        summary,
        values: storedValues,
        logo: logoRef,
      }),
    );
  } catch (error) {
    // Do not leave a logo behind that no record uses.
    if (logoRef) removeUnusedLogos(storage);
    return { ok: false, reason: writeFailureReason(error) };
  }

  // Read back, so a browser that silently ignores writes is not reported as saved.
  const saved = parseRecord(storage, id, safeGet(storage, historyRecordKey(id)));
  if (!saved) return { ok: false, reason: "error" };
  return { ok: true, record: saved };
}

/** Stores a logo once (shared) and returns its reference. Throws on storage errors. */
function storeLogo(storage: DraftStorage, dataUrl: string): string {
  const base = fnv1a(dataUrl);
  for (let n = 0; n < 50; n++) {
    const ref = n === 0 ? base : `${base}-${n}`;
    const existing = storage.getItem(historyLogoKey(ref));
    if (existing === null) {
      storage.setItem(historyLogoKey(ref), JSON.stringify({ version: HISTORY_VERSION, dataUrl }));
      return ref;
    }
    if (readLogoEntry(storage, ref) === dataUrl) return ref; // same logo already stored
  }
  throw new Error("Too many logos with the same fingerprint");
}

/* ───────────── deleting ───────────── */

/**
 * Deletes one record (readable or damaged) and any logo no record uses any more.
 * Returns true only if, read back afterwards, the record is gone.
 */
export function deleteHistoryRecord(storage: DraftStorage | null, id: string): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(historyRecordKey(id));
    const gone = storage.getItem(historyRecordKey(id)) === null;
    removeUnusedLogos(storage);
    return gone;
  } catch {
    return false;
  }
}

/** Removes logos that no stored record refers to. Best effort; never throws. */
function removeUnusedLogos(storage: DraftStorage): void {
  try {
    const used = new Set<string>();
    for (const key of keysWithPrefix(storage, DOC_PREFIX)) {
      const ref = logoRefOf(safeGet(storage, key));
      if (ref === undefined) return; // a record we cannot read might use a logo: keep all
      if (ref) used.add(ref);
    }
    for (const key of keysWithPrefix(storage, LOGO_PREFIX)) {
      if (!used.has(key.slice(LOGO_PREFIX.length))) storage.removeItem(key);
    }
  } catch {
    // Leaving an unused logo behind is harmless.
  }
}

/** The logo reference in a stored record: a ref, null for none, undefined if unreadable. */
function logoRefOf(raw: string | null): string | null | undefined {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== "object") return undefined;
    if (v.logo === null) return null;
    return typeof v.logo === "string" ? v.logo : undefined;
  } catch {
    return undefined;
  }
}

/* ───────────── helpers ───────────── */

function keysWithPrefix(storage: DraftStorage, prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

function safeGet(storage: DraftStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** A new id that is not in use: time-based, plus random characters. */
function newRecordId(storage: DraftStorage, now: Date): string {
  for (;;) {
    const random = new Uint32Array(2);
    globalThis.crypto.getRandomValues(random);
    const id = `${now.getTime().toString(36)}-${random[0]!.toString(36)}${random[1]!.toString(36)}`
      .toLowerCase()
      .slice(0, 40);
    if (safeGet(storage, historyRecordKey(id)) === null) return id;
  }
}

/** 32-bit FNV-1a fingerprint as 8 hex characters (not for security; collisions are checked). */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
