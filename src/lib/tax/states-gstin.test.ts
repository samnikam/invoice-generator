import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/lib/errors";
import { gstinCheckCharacter, validateGstinFormat } from "@/lib/tax/gstin";
import { ACTIVE_GST_STATES, GST_STATES, getActiveState, stateTaxLabel } from "@/lib/tax/states";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof InvalidInputError ? error.code : "not-InvalidInputError";
  }
  return undefined;
}

describe("GST state codes", () => {
  it("has unique two-digit codes", () => {
    const codes = GST_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^\d{2}$/);
  });

  it("covers India's 28 states and 8 union territories, plus Other Territory", () => {
    const kinds = ACTIVE_GST_STATES.map((s) => s.kind);
    expect(kinds.filter((k) => k === "state")).toHaveLength(28);
    expect(kinds.filter((k) => k === "ut" || k === "ut-with-legislature")).toHaveLength(8);
    expect(kinds.filter((k) => k === "ut-with-legislature")).toHaveLength(3);
    expect(kinds.filter((k) => k === "other-territory")).toHaveLength(1);
  });

  it.each([
    ["27", "Maharashtra", "SGST"],
    ["29", "Karnataka", "SGST"],
    ["37", "Andhra Pradesh", "SGST"],
    ["07", "Delhi", "SGST"],
    ["34", "Puducherry", "SGST"],
    ["01", "Jammu and Kashmir", "SGST"],
    ["04", "Chandigarh", "UTGST"],
    ["26", "Dadra and Nagar Haveli and Daman and Diu", "UTGST"],
    ["31", "Lakshadweep", "UTGST"],
    ["35", "Andaman and Nicobar Islands", "UTGST"],
    ["38", "Ladakh", "UTGST"],
    ["97", "Other Territory", "UTGST"],
  ])("code %s is %s and uses %s", (code, name, label) => {
    const state = getActiveState(code);
    expect(state.name).toBe(name);
    expect(stateTaxLabel(state)).toBe(label);
  });

  it("accepts surrounding spaces", () => {
    expect(getActiveState(" 27 ").code).toBe("27");
  });

  it.each(["", "  "])("treats %j as missing", (code) => {
    expect(codeOf(() => getActiveState(code))).toBe("required");
  });

  it.each(["7", "027", "AB", "00", "39", "96", "99", "MH"])("rejects unknown code %j", (code) => {
    expect(codeOf(() => getActiveState(code))).toBe("unknown_state");
  });

  it.each([
    ["25", "26"],
    ["28", "37"],
  ])("rejects legacy code %s and points to %s", (code, replacement) => {
    try {
      getActiveState(code);
      throw new Error("expected an error");
    } catch (error) {
      expect((error as InvalidInputError).code).toBe("unsupported_state");
      expect((error as InvalidInputError).message).toContain(`Use ${replacement}`);
    }
  });
});

describe("GSTIN format validation", () => {
  // 27AAPFU0939F1ZV is the widely published valid example. The others are synthetic
  // values whose check characters were produced with the reference implementation
  // (Devil7-Softwares/GSTIN-Validator), not with this project's code.
  it.each([
    ["27AAPFU0939F1ZV", "27", "AAPFU0939F"],
    ["07AAACR5055K1Z9", "07", "AAACR5055K"],
    ["33ABCDE1234F1Z7", "33", "ABCDE1234F"],
    ["04AAAAA0000A1ZA", "04", "AAAAA0000A"],
    ["29AABCT1332L1ZA", "29", "AABCT1332L"],
    ["38ZZZZZ9999Z9ZX", "38", "ZZZZZ9999Z"],
    ["97AAAAA0000A1ZV", "97", "AAAAA0000A"],
    ["27ABCDE1234F2ZZ", "27", "ABCDE1234F"],
  ])("accepts %s", (gstin, stateCode, pan) => {
    const result = validateGstinFormat(gstin);
    expect(result.gstin).toBe(gstin);
    expect(result.state.code).toBe(stateCode);
    expect(result.pan).toBe(pan);
  });

  it("normalises lowercase and surrounding spaces", () => {
    expect(validateGstinFormat("  27aapfu0939f1zv ").gstin).toBe("27AAPFU0939F1ZV");
  });

  it("computes the check character", () => {
    expect(gstinCheckCharacter("27AAPFU0939F1Z")).toBe("V");
    expect(gstinCheckCharacter("07AAACR5055K1Z")).toBe("9");
  });

  it.each([
    ["", "required"],
    ["27AAPFU0939F1Z", "invalid_gstin"], // 14 characters
    ["27AAPFU0939F1ZVX", "invalid_gstin"], // 16 characters
    ["27AAPFU0939F1ZA", "invalid_gstin"], // wrong check character
    ["27AAPFU0939F1ZW", "invalid_gstin"], // wrong check character
    ["27AAPFU0939F1YV", "invalid_gstin"], // 14th character must be Z
    ["27AAPFU0939F0ZV", "invalid_gstin"], // entity number cannot be 0
    ["27AAPF10939F1ZV", "invalid_gstin"], // PAN letters/digits in wrong places
    ["2XAAPFU0939F1ZV", "invalid_gstin"], // state code not numeric
    ["39AAPFU0939F1ZV", "invalid_gstin"], // unknown state code
    ["99AAPFU0939F1ZV", "invalid_gstin"], // Centre Jurisdiction not supported
    ["25AAPFU0939F1ZV", "invalid_gstin"], // legacy state code
    ["27AAPFU-939F1ZV", "invalid_gstin"], // symbol
    ["0717UNO00157UNO", "invalid_gstin"], // UIN format is not supported
  ])("rejects %j (%s)", (gstin, code) => {
    expect(codeOf(() => validateGstinFormat(gstin))).toBe(code);
  });

  it("detects a single mistyped character", () => {
    const valid = "27AAPFU0939F1ZV";
    // Change each of the first 14 characters to another valid character for that position.
    const replacements = "27BBQGV1040G2Z".split("");
    replacements.forEach((replacement, index) => {
      if (index === 13) return; // the 14th character is fixed to Z
      const mistyped = valid.slice(0, index) + replacement + valid.slice(index + 1);
      if (mistyped === valid) return;
      expect(
        codeOf(() => validateGstinFormat(mistyped)),
        mistyped,
      ).toBe("invalid_gstin");
    });
  });
});
