import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/lib/errors";
import { determineSupplyType, type PlaceOfSupply } from "@/lib/tax/supply-type";

function errorOf(fn: () => unknown): InvalidInputError {
  try {
    fn();
  } catch (error) {
    if (error instanceof InvalidInputError) return error;
    throw error;
  }
  throw new Error("expected an error");
}

const state = (stateCode: string, recipientIsSez = false): PlaceOfSupply => ({
  kind: "state",
  stateCode,
  recipientIsSez,
});

describe("determineSupplyType", () => {
  it("same state → intra-state with SGST", () => {
    const result = determineSupplyType({ sellerStateCode: "27", placeOfSupply: state("27") });
    expect(result).toMatchObject({ kind: "intra-state", stateTaxLabel: "SGST" });
  });

  it("same union territory without legislature → intra-state with UTGST", () => {
    const result = determineSupplyType({ sellerStateCode: "04", placeOfSupply: state("04") });
    expect(result).toMatchObject({ kind: "intra-state", stateTaxLabel: "UTGST" });
  });

  it("Delhi (UT with legislature) → SGST, not UTGST", () => {
    const result = determineSupplyType({ sellerStateCode: "07", placeOfSupply: state("07") });
    expect(result).toMatchObject({ kind: "intra-state", stateTaxLabel: "SGST" });
  });

  it("different states → inter-state", () => {
    expect(determineSupplyType({ sellerStateCode: "27", placeOfSupply: state("29") })).toEqual({
      kind: "inter-state",
      reason: "different-state",
    });
  });

  it("export (place of supply outside India) → inter-state", () => {
    expect(
      determineSupplyType({ sellerStateCode: "27", placeOfSupply: { kind: "outside-india" } }),
    ).toEqual({ kind: "inter-state", reason: "export" });
  });

  it("supply to an SEZ in the same state → inter-state", () => {
    expect(
      determineSupplyType({ sellerStateCode: "27", placeOfSupply: state("27", true) }),
    ).toEqual({ kind: "inter-state", reason: "sez" });
  });

  it("requires the seller state — never assumes it", () => {
    const error = errorOf(() =>
      determineSupplyType({ sellerStateCode: "", placeOfSupply: state("27") }),
    );
    expect(error.code).toBe("required");
    expect(error.field).toBe("sellerStateCode");
  });

  it("requires the place of supply — never assumes it", () => {
    const error = errorOf(() =>
      determineSupplyType({ sellerStateCode: "27", placeOfSupply: undefined }),
    );
    expect(error.code).toBe("required");
    expect(error.field).toBe("placeOfSupply");
  });

  it("rejects an unknown seller state", () => {
    const error = errorOf(() =>
      determineSupplyType({ sellerStateCode: "40", placeOfSupply: state("27") }),
    );
    expect(error.code).toBe("unknown_state");
    expect(error.field).toBe("sellerStateCode");
  });

  it("rejects an unknown or legacy place-of-supply state", () => {
    expect(
      errorOf(() => determineSupplyType({ sellerStateCode: "27", placeOfSupply: state("96") }))
        .code,
    ).toBe("unknown_state");
    const legacy = errorOf(() =>
      determineSupplyType({ sellerStateCode: "27", placeOfSupply: state("28") }),
    );
    expect(legacy.code).toBe("unsupported_state");
    expect(legacy.field).toBe("placeOfSupply.stateCode");
  });
});
