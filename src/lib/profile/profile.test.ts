import { describe, expect, it } from "vitest";

import { evaluateDocument, createEmptyDocument } from "@/lib/documents/billing-document";
import { writeDraft, type DraftStorage } from "@/lib/drafts/draft-storage";
import {
  createEmptyProfile,
  evaluateProfile,
  normaliseProfile,
  stateFromGstin,
  toReceiptBusiness,
  toSellerFields,
  type BusinessProfile,
} from "@/lib/profile/business-profile";
import {
  deleteProfile,
  parseStoredProfile,
  PROFILE_STORAGE_KEY,
  readProfile,
  writeProfile,
} from "@/lib/profile/profile-storage";

function memoryStorage(failWith?: () => Error): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (failWith) throw failWith();
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

const PROFILE: BusinessProfile = {
  name: "Sample Design Studio",
  address: "12 MG Road\nPune",
  phone: "+91 98765 43210",
  email: "hello@example.com",
  gstin: "27AAPFU0939F1ZV", // published valid example (Maharashtra)
  stateCode: "27",
};

describe("evaluateProfile", () => {
  it("accepts a complete profile and a name-only profile", () => {
    expect(evaluateProfile(PROFILE).issues).toEqual([]);
    expect(evaluateProfile({ ...createEmptyProfile(), name: "Small Tutor" }).issues).toEqual([]);
  });

  it("requires a business name", () => {
    expect(evaluateProfile(createEmptyProfile()).errors).toEqual({
      name: "Business name is required.",
    });
  });

  it("reuses the document limits and contact checks", () => {
    const { errors } = evaluateProfile({
      ...PROFILE,
      name: "x".repeat(101),
      address: "y".repeat(301),
      phone: "call me",
      email: "not-an-email",
    });
    expect(errors.name).toBe("Business name must be 100 characters or fewer.");
    expect(errors.address).toBe("Business address must be 300 characters or fewer.");
    expect(errors.phone).toMatch(/valid phone number/);
    expect(errors.email).toMatch(/valid email address/);
  });

  it("checks GSTIN format and check character", () => {
    expect(evaluateProfile({ ...PROFILE, gstin: "27AAPFU0939F1ZA" }).errors.gstin).toMatch(
      /check character/,
    );
    expect(evaluateProfile({ ...PROFILE, gstin: "12345" }).errors.gstin).toMatch(/15 characters/);
  });

  it("requires the state to match the GSTIN, and names the right state", () => {
    expect(evaluateProfile({ ...PROFILE, stateCode: "" }).errors.stateCode).toBe(
      "Select the state of registration. This GSTIN is registered in Maharashtra (27).",
    );
    expect(evaluateProfile({ ...PROFILE, stateCode: "29" }).errors.stateCode).toBe(
      "This GSTIN is registered in Maharashtra (27), but the state selected is Karnataka (29).",
    );
  });

  it("allows a state without a GSTIN, but rejects unknown or retired states", () => {
    expect(evaluateProfile({ ...PROFILE, gstin: "", stateCode: "29" }).issues).toEqual([]);
    expect(evaluateProfile({ ...PROFILE, gstin: "", stateCode: "99" }).errors.stateCode).toMatch(
      /not a recognised/,
    );
    expect(evaluateProfile({ ...PROFILE, gstin: "", stateCode: "28" }).errors.stateCode).toMatch(
      /no longer used/,
    );
  });

  it("finds the state from a valid GSTIN only", () => {
    expect(stateFromGstin("27AAPFU0939F1ZV")?.code).toBe("27");
    expect(stateFromGstin("27AAPFU0939F1ZA")).toBeNull();
    expect(stateFromGstin("")).toBeNull();
  });

  it("normalises spaces and GSTIN case for saving", () => {
    expect(
      normaliseProfile({ ...PROFILE, name: "  Sample  ", gstin: " 27aapfu0939f1zv " }),
    ).toMatchObject({ name: "Sample", gstin: "27AAPFU0939F1ZV" });
  });
});

describe("mapping the profile onto documents", () => {
  it("invoices and quotations receive every business field", () => {
    expect(toSellerFields(PROFILE)).toEqual({
      name: PROFILE.name,
      address: PROFILE.address,
      phone: PROFILE.phone,
      email: PROFILE.email,
      gstin: PROFILE.gstin,
      stateCode: PROFILE.stateCode,
    });
  });

  it("receipts receive contact details only — never GSTIN or state", () => {
    const business = toReceiptBusiness(PROFILE);
    expect(business).toEqual({
      name: PROFILE.name,
      address: PROFILE.address,
      phone: PROFILE.phone,
      email: PROFILE.email,
    });
    expect(Object.keys(business)).not.toContain("gstin");
    expect(Object.keys(business)).not.toContain("stateCode");
  });

  it("a valid saved profile passes the invoice's own business checks", () => {
    const doc = {
      ...createEmptyDocument("invoice"),
      gstMode: "with-gst" as const,
      seller: toSellerFields(PROFILE),
    };
    const sellerErrors = Object.keys(evaluateDocument(doc).errors).filter((k) =>
      k.startsWith("seller."),
    );
    expect(sellerErrors).toEqual([]);
  });
});

describe("profile storage", () => {
  const NOW = new Date("2026-10-23T11:00:00.000Z");

  it("saves under a versioned key and reads it back exactly", () => {
    const storage = memoryStorage();
    expect(PROFILE_STORAGE_KEY).toBe("smartbill.profile.v1");
    expect(writeProfile(storage, PROFILE, NOW)).toEqual({ ok: true, savedAt: NOW.toISOString() });
    expect(readProfile(storage)).toEqual({
      status: "loaded",
      profile: PROFILE,
      savedAt: NOW.toISOString(),
    });
  });

  it("returns 'none' when nothing is saved, and never writes while reading", () => {
    const storage = memoryStorage(() => new Error("no writes allowed"));
    expect(readProfile(storage)).toEqual({ status: "none" });
  });

  it.each([
    ["not JSON", "{oops"],
    [
      "wrong version",
      JSON.stringify({ version: 2, savedAt: "2026-10-23T11:00:00.000Z", profile: PROFILE }),
    ],
    ["bad save time", JSON.stringify({ version: 1, savedAt: "soon", profile: PROFILE })],
    [
      "missing field",
      JSON.stringify({ version: 1, savedAt: "2026-10-23T11:00:00.000Z", profile: { name: "x" } }),
    ],
    [
      "wrong type",
      JSON.stringify({
        version: 1,
        savedAt: "2026-10-23T11:00:00.000Z",
        profile: { ...PROFILE, phone: 42 },
      }),
    ],
  ])("reports damaged data (%s) as 'invalid' without throwing", (_label, raw) => {
    const storage = memoryStorage();
    storage.data.set(PROFILE_STORAGE_KEY, raw);
    expect(readProfile(storage)).toEqual({ status: "invalid" });
  });

  it("reports a profile left by another version as 'invalid'", () => {
    const storage = memoryStorage();
    storage.data.set("smartbill.profile.v0", "{}");
    expect(readProfile(storage)).toEqual({ status: "invalid" });
  });

  it("drops unknown fields from a stored profile", () => {
    expect(parseStoredProfile({ ...PROFILE, logo: "data:..." })).toEqual(PROFILE);
  });

  it("reports blocked and full storage", () => {
    expect(readProfile(null)).toEqual({ status: "unavailable" });
    expect(writeProfile(null, PROFILE)).toEqual({ ok: false, reason: "unavailable" });
    const full = memoryStorage(() => new DOMException("full", "QuotaExceededError"));
    expect(writeProfile(full, PROFILE)).toEqual({ ok: false, reason: "quota" });
    const refused = memoryStorage(() => new DOMException("denied", "SecurityError"));
    expect(writeProfile(refused, PROFILE)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports a refused or silently ignored deletion as a failure", () => {
    const refused = memoryStorage();
    writeProfile(refused, PROFILE);
    refused.removeItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    expect(deleteProfile(refused)).toBe(false);
    expect(refused.data.has(PROFILE_STORAGE_KEY)).toBe(true);

    const ignored = memoryStorage();
    writeProfile(ignored, PROFILE);
    ignored.removeItem = () => {};
    expect(deleteProfile(ignored)).toBe(false);

    expect(deleteProfile(null)).toBe(false);
  });

  it("deleting the profile leaves drafts and other data untouched", () => {
    const storage = memoryStorage();
    writeProfile(storage, PROFILE);
    storage.data.set("smartbill.profile.v0", "{}");
    writeDraft(storage, "invoice", createEmptyDocument("invoice"));
    storage.data.set("unrelated", "keep");
    expect(deleteProfile(storage)).toBe(true);
    expect([...storage.data.keys()].sort()).toEqual(["smartbill.draft.v1.invoice", "unrelated"]);
  });
});
