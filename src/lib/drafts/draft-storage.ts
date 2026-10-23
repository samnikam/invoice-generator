/**
 * BROWSER-LOCAL DRAFTS
 * ════════════════════
 * Optional, user-enabled saving of an unfinished document in this browser's
 * localStorage. Nothing here runs on the server and nothing is uploaded.
 *
 * Storage is NOT encrypted: anyone using the same browser profile can read it.
 *
 * Layout: one key per document type, versioned in both the key and the stored value,
 *   smartbill.draft.v1.invoice   → { version: 1, kind: "invoice", savedAt, values }
 * so invoice, quotation and receipt drafts can never overwrite each other, and a future
 * format change can be detected instead of misread.
 *
 * Opt-in: nothing is written until the user turns saving on. Before that, storage is only
 * read (to restore an earlier draft) — there is no "probe" write.
 *
 * Several tabs: two tabs editing the same document type share one key, and whichever
 * tab saves last wins. Tabs are not synchronised with each other.
 *
 * Every function here reports problems as results; none of them throws.
 */
export const DRAFT_VERSION = 1;
const KEY_PREFIX = "smartbill.draft.";

export type DraftKind = "invoice" | "quotation" | "receipt";

export function draftStorageKey(kind: DraftKind, version: number = DRAFT_VERSION): string {
  return `${KEY_PREFIX}v${version}.${kind}`;
}

type DraftEnvelope = { version: number; kind: DraftKind; savedAt: string; values: unknown };

export type DraftReadResult<T> =
  | { status: "none" }
  | { status: "restored"; values: T; savedAt: string }
  /** Present but unreadable: corrupt, from another version, or the wrong shape. */
  | { status: "invalid" }
  | { status: "unavailable" };

export type DraftWriteResult =
  { ok: true; savedAt: string } | { ok: false; reason: "unavailable" | "quota" | "error" };

/** Minimal Storage interface, so tests can pass an in-memory implementation. */
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/**
 * Returns window.localStorage if it can be read, otherwise null. Reading can throw when
 * storage is blocked (cookie settings, some private-browsing modes). This never writes:
 * a browser that allows reading but refuses writes is detected by writeDraft instead.
 */
export function getBrowserStorage(): DraftStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const storage = window.localStorage;
    storage.getItem(draftStorageKey("invoice")); // read-only access check
    return storage;
  } catch {
    return null;
  }
}

/** Classifies a failed localStorage write. Shared with the business profile store. */
export function writeFailureReason(error: unknown): "quota" | "unavailable" | "error" {
  if (!(error instanceof DOMException)) return "error";
  if (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  ) {
    return "quota";
  }
  // Storage present but writes refused (e.g. blocked by browser settings).
  if (error.name === "SecurityError" || error.name === "InvalidStateError") return "unavailable";
  return "error";
}

/** Reads and checks a draft. `parse` must return null for any value of the wrong shape. */
export function readDraft<T>(
  storage: DraftStorage | null,
  kind: DraftKind,
  parse: (values: unknown) => T | null,
): DraftReadResult<T> {
  if (!storage) return { status: "unavailable" };

  let raw: string | null;
  try {
    raw = storage.getItem(draftStorageKey(kind));
  } catch {
    return { status: "unavailable" };
  }
  if (raw === null) {
    // No current draft — but a draft written by another version would be unreadable.
    return hasOtherVersionDraft(storage, kind) ? { status: "invalid" } : { status: "none" };
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  if (!isEnvelope(envelope) || envelope.version !== DRAFT_VERSION || envelope.kind !== kind) {
    return { status: "invalid" };
  }
  const values = parse(envelope.values);
  return values === null
    ? { status: "invalid" }
    : { status: "restored", values, savedAt: envelope.savedAt };
}

export function writeDraft(
  storage: DraftStorage | null,
  kind: DraftKind,
  values: unknown,
  now: Date = new Date(),
): DraftWriteResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  const envelope: DraftEnvelope = {
    version: DRAFT_VERSION,
    kind,
    savedAt: now.toISOString(),
    values,
  };
  try {
    storage.setItem(draftStorageKey(kind), JSON.stringify(envelope));
    return { ok: true, savedAt: envelope.savedAt };
  } catch (error) {
    return { ok: false, reason: writeFailureReason(error) };
  }
}

/**
 * Deletes this document type's draft, including drafts left by other versions.
 * Returns true only if, read back afterwards, no draft of this type remains — so a
 * browser that refuses or silently ignores the deletion is reported as a failure.
 */
export function deleteDraft(storage: DraftStorage | null, kind: DraftKind): boolean {
  if (!storage) return false;
  try {
    for (const key of draftKeysFor(storage, kind)) storage.removeItem(key);
    return draftKeysFor(storage, kind).length === 0;
  } catch {
    return false;
  }
}

/* ───────────── helpers ───────────── */

function isEnvelope(value: unknown): value is DraftEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === "number" &&
    typeof v.kind === "string" &&
    typeof v.savedAt === "string" &&
    !Number.isNaN(Date.parse(v.savedAt)) &&
    "values" in v
  );
}

/** All keys holding a draft of this kind, in any version. */
function draftKeysFor(storage: DraftStorage, kind: DraftKind): string[] {
  const pattern = new RegExp(`^${KEY_PREFIX.replace(/\./g, "\\.")}v\\d+\\.${kind}$`);
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && pattern.test(key)) keys.push(key);
  }
  return keys;
}

function hasOtherVersionDraft(storage: DraftStorage, kind: DraftKind): boolean {
  try {
    return draftKeysFor(storage, kind).some((key) => key !== draftStorageKey(kind));
  } catch {
    return false;
  }
}
