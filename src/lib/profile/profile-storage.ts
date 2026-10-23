import { writeFailureReason, type DraftStorage } from "@/lib/drafts/draft-storage";
import type { BusinessProfile } from "@/lib/profile/business-profile";

/**
 * BUSINESS PROFILE STORAGE (browser-local)
 * ════════════════════════════════════════
 * Key `smartbill.profile.v1` holds { version: 1, savedAt, profile }.
 *
 * - Written ONLY when the user presses "Save profile"; reading happens after page load.
 * - Not uploaded and not encrypted; visible to anyone using the same browser profile.
 * - Nothing here throws: problems are returned as results.
 *
 * This module is the only place that knows the profile lives in localStorage. When
 * accounts arrive (Phase 2), these three functions can be replaced by server storage
 * without changing the forms or documents.
 */
export const PROFILE_VERSION = 1;
const KEY_PREFIX = "smartbill.profile.";
export const PROFILE_STORAGE_KEY = `${KEY_PREFIX}v${PROFILE_VERSION}`;

export type ProfileReadResult =
  | { status: "none" }
  | { status: "loaded"; profile: BusinessProfile; savedAt: string }
  /** Present but unreadable: damaged, from another version, or the wrong shape. */
  | { status: "invalid" }
  | { status: "unavailable" };

export type ProfileWriteResult =
  { ok: true; savedAt: string } | { ok: false; reason: "unavailable" | "quota" | "error" };

const MAX_TEXT = 5000;

/** Rebuilds a stored profile field by field; null if anything is missing or wrong. */
export function parseStoredProfile(raw: unknown): BusinessProfile | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const fields = ["name", "address", "phone", "email", "gstin", "stateCode"] as const;
  for (const field of fields) {
    const value = p[field];
    if (typeof value !== "string" || value.length > MAX_TEXT) return null;
  }
  return {
    name: p.name as string,
    address: p.address as string,
    phone: p.phone as string,
    email: p.email as string,
    gstin: p.gstin as string,
    stateCode: p.stateCode as string,
  };
}

function otherVersionKeys(storage: DraftStorage): string[] {
  const pattern = /^smartbill\.profile\.v\d+$/;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && pattern.test(key) && key !== PROFILE_STORAGE_KEY) keys.push(key);
  }
  return keys;
}

export function readProfile(storage: DraftStorage | null): ProfileReadResult {
  if (!storage) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (raw === null) {
      return otherVersionKeys(storage).length > 0 ? { status: "invalid" } : { status: "none" };
    }
  } catch {
    return { status: "unavailable" };
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  if (typeof envelope !== "object" || envelope === null) return { status: "invalid" };
  const e = envelope as Record<string, unknown>;
  if (
    e.version !== PROFILE_VERSION ||
    typeof e.savedAt !== "string" ||
    Number.isNaN(Date.parse(e.savedAt))
  ) {
    return { status: "invalid" };
  }
  const profile = parseStoredProfile(e.profile);
  return profile ? { status: "loaded", profile, savedAt: e.savedAt } : { status: "invalid" };
}

export function writeProfile(
  storage: DraftStorage | null,
  profile: BusinessProfile,
  now: Date = new Date(),
): ProfileWriteResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  const savedAt = now.toISOString();
  try {
    storage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ version: PROFILE_VERSION, savedAt, profile }),
    );
    return { ok: true, savedAt };
  } catch (error) {
    return { ok: false, reason: writeFailureReason(error) };
  }
}

/**
 * Deletes the saved profile (any version). Drafts and other data are not touched.
 * Returns true only if, read back afterwards, no profile remains — so a browser that
 * refuses or silently ignores the deletion is reported as a failure.
 */
export function deleteProfile(storage: DraftStorage | null): boolean {
  if (!storage) return false;
  try {
    for (const key of [PROFILE_STORAGE_KEY, ...otherVersionKeys(storage)]) storage.removeItem(key);
    return storage.getItem(PROFILE_STORAGE_KEY) === null && otherVersionKeys(storage).length === 0;
  } catch {
    return false;
  }
}
