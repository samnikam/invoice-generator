import { describe, expect, it } from "vitest";

import { placeOfSupplySuggestion } from "@/lib/documents/place-of-supply-suggestion";
import { OUTSIDE_INDIA } from "@/lib/calculators/place-of-supply";

// 27AAPFU0939F1ZV is the widely published valid example (Maharashtra). The other two use
// the same PAN with their own state codes and correct check characters (test data only).
const MAHARASHTRA = "27AAPFU0939F1ZV";
const KARNATAKA = "29AAPFU0939F1ZR";
const DELHI = "07AAPFU0939F1ZX";

describe("placeOfSupplySuggestion", () => {
  it("suggests the GSTIN's state when no place of supply is chosen", () => {
    expect(placeOfSupplySuggestion(MAHARASHTRA, "")).toMatchObject({
      kind: "suggest",
      state: { code: "27", name: "Maharashtra" },
      placeOfSupplyChosen: false,
    });
    expect(placeOfSupplySuggestion(KARNATAKA, "")).toMatchObject({ state: { code: "29" } });
    expect(placeOfSupplySuggestion(DELHI, "")).toMatchObject({ state: { code: "07" } });
  });

  it("still only suggests when a different place of supply was chosen", () => {
    expect(placeOfSupplySuggestion(MAHARASHTRA, "29")).toMatchObject({
      kind: "suggest",
      state: { code: "27" },
      placeOfSupplyChosen: true,
    });
    expect(placeOfSupplySuggestion(MAHARASHTRA, OUTSIDE_INDIA)).toMatchObject({
      kind: "suggest",
      placeOfSupplyChosen: true,
    });
  });

  it("reports a match when the place of supply already is the GSTIN's state", () => {
    expect(placeOfSupplySuggestion(MAHARASHTRA, "27")).toMatchObject({
      kind: "matches",
      state: { code: "27" },
    });
  });

  it("accepts lower case and surrounding spaces, like the GSTIN field itself", () => {
    expect(placeOfSupplySuggestion("  27aapfu0939f1zv ", "")).toMatchObject({
      state: { code: "27" },
    });
  });

  it.each([
    ["empty", ""],
    ["spaces only", "   "],
    ["incomplete (2 digits)", "27"],
    ["incomplete (14 characters)", "27AAPFU0939F1Z"],
    ["wrong check character", "27AAPFU0939F1ZA"],
    ["bad format", "27AAPFU0939F1!V"],
    ["not a current state code", "99AAPFU0939F1ZV"],
  ])("gives no suggestion for an invalid or incomplete GSTIN (%s)", (_label, gstin) => {
    expect(placeOfSupplySuggestion(gstin, "")).toBeNull();
  });
});
