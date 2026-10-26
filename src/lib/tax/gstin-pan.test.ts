import { describe, expect, it } from "vitest";

import { panFromGstin } from "@/lib/tax/gstin-pan";

describe("panFromGstin", () => {
  it("reads the PAN (characters 3–12) from a valid regular GSTIN", () => {
    expect(panFromGstin("27AAPFU0939F1ZV")).toBe("AAPFU0939F");
    expect(panFromGstin("29AAPFU0939F1ZR")).toBe("AAPFU0939F");
  });

  it("accepts lower case and spaces, like the GSTIN field", () => {
    expect(panFromGstin("  27aapfu0939f1zv ")).toBe("AAPFU0939F");
  });

  it.each([
    ["empty", ""],
    ["incomplete", "27AAPFU0939F1Z"],
    ["wrong check character", "27AAPFU0939F1ZA"],
    ["bad format", "27AAPFU0939F1!V"],
    ["not a current state code", "99AAPFU0939F1ZV"],
  ])("never returns a PAN for an invalid GSTIN (%s)", (_label, gstin) => {
    expect(panFromGstin(gstin)).toBeNull();
  });
});
