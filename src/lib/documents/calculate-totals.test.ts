import { describe, expect, it } from "vitest";

import {
  calculateDocumentTotals,
  type LineItemInput,
  type TaxContext,
} from "@/lib/documents/calculate-totals";
import { InvalidInputError } from "@/lib/errors";
import { NO_DISCOUNT, type Discount } from "@/lib/money/discount";
import { MAX_AMOUNT_PAISE, type Paise } from "@/lib/money/paise";
import type { BasisPoints } from "@/lib/money/percent";
import type { QuantityThousandths } from "@/lib/money/quantity";
import type { GstRateId } from "@/lib/tax/gst-rates";

/* ───────────── helpers ───────────── */

const qty = (thousandths: number) => thousandths as QuantityThousandths;
const paise = (n: number) => n as Paise;
const percentOff = (bp: number): Discount => ({ kind: "percent", basisPoints: bp as BasisPoints });
const amountOff = (n: number): Discount => ({ kind: "amount", paise: n as Paise });
const taxable = (rateId: GstRateId) => ({ treatment: "taxable", rateId }) as const;

function line(
  quantityThousandths: number,
  unitPricePaise: number,
  discount: Discount,
  tax?: LineItemInput["tax"],
): LineItemInput {
  return {
    quantity: qty(quantityThousandths),
    unitPricePaise: paise(unitPricePaise),
    discount,
    tax,
  };
}

const maharashtraSeller = (
  placeOfSupply: Extract<TaxContext, { chargesGst: true }>["placeOfSupply"],
): TaxContext => ({ chargesGst: true, sellerStateCode: "27", placeOfSupply });

function errorOf(fn: () => unknown): InvalidInputError {
  try {
    fn();
  } catch (error) {
    if (error instanceof InvalidInputError) return error;
    throw error;
  }
  throw new Error("expected an error");
}

/*
 * Shared three-line example used by the intra- and inter-state scenarios.
 * Worked by hand:
 *
 *   L1: 2 × ₹1,250.00, 10% discount, GST 18%
 *       value 2,500.00 · discount 250.00 · taxable 2,250.00
 *   L2: 1.5 × ₹333.33, ₹50.00 off, GST 5%
 *       value 499.995 → 500.00 (half up) · discount 50.00 · taxable 450.00
 *   L3: 3 × ₹99.99, no discount, GST 18%
 *       value 299.97 · taxable 299.97
 *
 *   Totals: value 3,299.97 · discount 300.00 · taxable 2,999.97
 */
const threeLines = (): LineItemInput[] => [
  line(2000, 125000, percentOff(1000), taxable("18")),
  line(1500, 33333, amountOff(5000), taxable("5")),
  line(3000, 9999, NO_DISCOUNT, taxable("18")),
];

/* ───────────── scenarios ───────────── */

describe("calculateDocumentTotals — intra-state (Maharashtra → Maharashtra)", () => {
  /*
   *   L1 CGST 9% of 2,250.00 = 202.50 · SGST 202.50 · line total 2,655.00
   *   L2 CGST 2.5% of 450.00 = 11.25 · SGST 11.25   · line total 472.50
   *   L3 CGST 9% of 299.97 = 26.9973 → 27.00 · SGST 27.00 · line total 353.97
   *   CGST 240.75 · SGST 240.75 · tax 481.50
   *   Total 2,999.97 + 481.50 = 3,481.47 → round off −0.47 → ₹3,481.00
   */
  const totals = calculateDocumentTotals({
    lines: threeLines(),
    taxContext: maharashtraSeller({ kind: "state", stateCode: "27" }),
    roundOffToNearestRupee: true,
  });

  it("identifies the supply as intra-state with SGST", () => {
    expect(totals.supplyType).toMatchObject({ kind: "intra-state", stateTaxLabel: "SGST" });
  });

  it("calculates each line", () => {
    expect(totals.lines).toEqual([
      {
        grossPaise: 250000,
        discountPaise: 25000,
        taxablePaise: 225000,
        treatment: "taxable",
        rateId: "18",
        rateBasisPoints: 1800,
        cgstPaise: 20250,
        sgstPaise: 20250,
        igstPaise: 0,
        totalPaise: 265500,
      },
      {
        grossPaise: 50000,
        discountPaise: 5000,
        taxablePaise: 45000,
        treatment: "taxable",
        rateId: "5",
        rateBasisPoints: 500,
        cgstPaise: 1125,
        sgstPaise: 1125,
        igstPaise: 0,
        totalPaise: 47250,
      },
      {
        grossPaise: 29997,
        discountPaise: 0,
        taxablePaise: 29997,
        treatment: "taxable",
        rateId: "18",
        rateBasisPoints: 1800,
        cgstPaise: 2700,
        sgstPaise: 2700,
        igstPaise: 0,
        totalPaise: 35397,
      },
    ]);
  });

  it("calculates document totals and round off", () => {
    expect(totals).toMatchObject({
      grossPaise: 329997,
      discountPaise: 30000,
      taxablePaise: 299997,
      cgstPaise: 24075,
      sgstPaise: 24075,
      igstPaise: 0,
      totalTaxPaise: 48150,
      totalBeforeRoundOffPaise: 348147,
      roundOffPaise: -47,
      grandTotalPaise: 348100,
    });
  });

  it("line totals add up to the total before round off", () => {
    const sumOfLines = totals.lines.reduce((sum, l) => sum + l.totalPaise, 0);
    expect(sumOfLines).toBe(348147);
  });

  it("groups tax by rate, lowest rate first", () => {
    expect(totals.rateSummary).toEqual([
      {
        rateId: "5",
        rateBasisPoints: 500,
        taxablePaise: 45000,
        cgstPaise: 1125,
        sgstPaise: 1125,
        igstPaise: 0,
      },
      {
        rateId: "18",
        rateBasisPoints: 1800,
        taxablePaise: 254997,
        cgstPaise: 22950,
        sgstPaise: 22950,
        igstPaise: 0,
      },
    ]);
  });
});

describe("calculateDocumentTotals — inter-state (Maharashtra → Karnataka)", () => {
  /*
   *   L1 IGST 18% of 2,250.00 = 405.00
   *   L2 IGST 5% of 450.00 = 22.50
   *   L3 IGST 18% of 299.97 = 53.9946 → 53.99   (intra-state gave 27.00 + 27.00 = 54.00)
   *   IGST 481.49 · total 3,481.46 → round off −0.46 → ₹3,481.00
   */
  const totals = calculateDocumentTotals({
    lines: threeLines(),
    taxContext: maharashtraSeller({ kind: "state", stateCode: "29" }),
    roundOffToNearestRupee: true,
  });

  it("uses IGST only", () => {
    expect(totals.supplyType).toEqual({ kind: "inter-state", reason: "different-state" });
    expect(totals.lines.map((l) => [l.cgstPaise, l.sgstPaise, l.igstPaise])).toEqual([
      [0, 0, 40500],
      [0, 0, 2250],
      [0, 0, 5399],
    ]);
  });

  it("calculates document totals and round off", () => {
    expect(totals).toMatchObject({
      taxablePaise: 299997,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 48149,
      totalTaxPaise: 48149,
      totalBeforeRoundOffPaise: 348146,
      roundOffPaise: -46,
      grandTotalPaise: 348100,
    });
  });
});

/*
 * ROUND-OFF RULE: the final total is rounded to the nearest whole rupee, HALF UP.
 * Exactly 50 paise rounds UP (₹1,000.50 → ₹1,001.00, round off +₹0.50).
 * 49 paise or less rounds down; 51 paise or more rounds up.
 * Expected values below were also confirmed with Python's Decimal ROUND_HALF_UP.
 */
describe("calculateDocumentTotals — round off", () => {
  const noGst: TaxContext = { chargesGst: false };

  it.each([
    // total (paise), expected grand total, expected round off
    [100050, 100100, 50], // ₹1,000.50 → ₹1,001 (exactly half rounds up)
    [100049, 100000, -49], // ₹1,000.49 → ₹1,000
    [100051, 100100, 49], // ₹1,000.51 → ₹1,001
    [100099, 100100, 1], // ₹1,000.99 → ₹1,001
    [100001, 100000, -1], // ₹1,000.01 → ₹1,000
    [100000, 100000, 0], // already whole rupees
    [50, 100, 50], // ₹0.50 → ₹1 (exactly half rounds up)
    [49, 0, -49], // ₹0.49 → ₹0
    [1, 0, -1], // ₹0.01 → ₹0
  ])("rounds %i paise to %i (round off %i)", (total, grand, roundOff) => {
    const totals = calculateDocumentTotals({
      lines: [line(1000, total, NO_DISCOUNT)],
      taxContext: noGst,
      roundOffToNearestRupee: true,
    });
    expect(totals.totalBeforeRoundOffPaise).toBe(total);
    expect(totals.grandTotalPaise).toBe(grand);
    expect(totals.roundOffPaise).toBe(roundOff);
  });

  it("does not round when round off is turned off", () => {
    const totals = calculateDocumentTotals({
      lines: [line(1000, 100049, NO_DISCOUNT)],
      taxContext: noGst,
      roundOffToNearestRupee: false,
    });
    expect(totals.grandTotalPaise).toBe(100049);
    expect(totals.roundOffPaise).toBe(0);
  });

  it("applies round off to the GST-inclusive total, after per-line tax rounding", () => {
    // ₹100.00 at 18% intra-state: CGST 9.00 + SGST 9.00 = ₹118.00 → no round off.
    // ₹100.50 at 18% intra-state: CGST 9.045 → 9.05, SGST 9.05 → ₹118.60 → ₹119 (+0.40).
    const totals = calculateDocumentTotals({
      lines: [line(1000, 10050, NO_DISCOUNT, taxable("18"))],
      taxContext: maharashtraSeller({ kind: "state", stateCode: "27" }),
      roundOffToNearestRupee: true,
    });
    expect(totals).toMatchObject({
      cgstPaise: 905,
      sgstPaise: 905,
      totalBeforeRoundOffPaise: 11860,
      roundOffPaise: 40,
      grandTotalPaise: 11900,
    });
  });

  it("reports a clear error if rounding up would exceed the maximum amount", () => {
    // ₹9,99,99,99,99,999.99 would round up to ₹10,00,00,00,00,000 — beyond the limit.
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          lines: [line(1000, MAX_AMOUNT_PAISE, NO_DISCOUNT)],
          taxContext: noGst,
          roundOffToNearestRupee: true,
        }),
      ),
    ).toMatchObject({ code: "too_large", field: "total" });
  });
});

describe("calculateDocumentTotals — special supplies", () => {
  it("UT without legislature (Chandigarh) is labelled UTGST", () => {
    const totals = calculateDocumentTotals({
      lines: [line(1000, 100000, NO_DISCOUNT, taxable("18"))],
      taxContext: {
        chargesGst: true,
        sellerStateCode: "04",
        placeOfSupply: { kind: "state", stateCode: "04" },
      },
      roundOffToNearestRupee: false,
    });
    expect(totals.supplyType).toMatchObject({ kind: "intra-state", stateTaxLabel: "UTGST" });
    // ₹1,000 at 18%: CGST 90.00 + UTGST 90.00
    expect(totals).toMatchObject({ cgstPaise: 9000, sgstPaise: 9000, grandTotalPaise: 118000 });
  });

  it("supply to an SEZ in the same state uses IGST", () => {
    const totals = calculateDocumentTotals({
      lines: [line(1000, 100000, NO_DISCOUNT, taxable("18"))],
      taxContext: maharashtraSeller({ kind: "state", stateCode: "27", recipientIsSez: true }),
      roundOffToNearestRupee: false,
    });
    expect(totals).toMatchObject({
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 18000,
      grandTotalPaise: 118000,
    });
  });

  it("export under LUT carries no tax and is reported as zero-rated", () => {
    const totals = calculateDocumentTotals({
      lines: [line(1000, 500000, NO_DISCOUNT, { treatment: "zero-rated-lut" })],
      taxContext: maharashtraSeller({ kind: "outside-india" }),
      roundOffToNearestRupee: false,
    });
    expect(totals.supplyType).toEqual({ kind: "inter-state", reason: "export" });
    expect(totals).toMatchObject({ totalTaxPaise: 0, grandTotalPaise: 500000 });
    expect(totals.nonTaxableValuePaise["zero-rated-lut"]).toBe(500000);
    expect(totals.lines[0]?.treatment).toBe("zero-rated-lut");
  });

  it("export with payment of IGST is taxed as IGST", () => {
    const totals = calculateDocumentTotals({
      lines: [line(1000, 500000, NO_DISCOUNT, taxable("18"))],
      taxContext: maharashtraSeller({ kind: "outside-india" }),
      roundOffToNearestRupee: false,
    });
    // ₹5,000 at 18% = ₹900 IGST
    expect(totals).toMatchObject({ igstPaise: 90000, grandTotalPaise: 590000 });
  });

  it("keeps nil-rated, exempt and non-GST values separate from taxable supplies", () => {
    /*
     *   taxable 18%: ₹1,000.00 → CGST 90.00 + SGST 90.00
     *   nil-rated:   ₹200.00
     *   exempt:      ₹300.00
     *   non-GST:     ₹400.00
     *   total = 1,000 + 180 + 200 + 300 + 400 = ₹2,080.00
     */
    const totals = calculateDocumentTotals({
      lines: [
        line(1000, 100000, NO_DISCOUNT, taxable("18")),
        line(1000, 20000, NO_DISCOUNT, { treatment: "nil-rated" }),
        line(1000, 30000, NO_DISCOUNT, { treatment: "exempt" }),
        line(1000, 40000, NO_DISCOUNT, { treatment: "non-gst" }),
      ],
      taxContext: maharashtraSeller({ kind: "state", stateCode: "27" }),
      roundOffToNearestRupee: false,
    });
    expect(totals).toMatchObject({
      taxablePaise: 190000,
      cgstPaise: 9000,
      sgstPaise: 9000,
      totalTaxPaise: 18000,
      grandTotalPaise: 208000,
      nonTaxableValuePaise: {
        "nil-rated": 20000,
        exempt: 30000,
        "non-gst": 40000,
        "zero-rated-lut": 0,
      },
    });
    expect(totals.rateSummary).toEqual([
      {
        rateId: "18",
        rateBasisPoints: 1800,
        taxablePaise: 100000,
        cgstPaise: 9000,
        sgstPaise: 9000,
        igstPaise: 0,
      },
    ]);
  });

  it("document that does not charge GST (e.g. bill of supply) has no tax at all", () => {
    /*   2 × ₹750.00 = 1,500.00, 20% off = 300.00 → ₹1,200.00
     *   1 × ₹99.50 → ₹99.50                    total ₹1,299.50 */
    const totals = calculateDocumentTotals({
      lines: [line(2000, 75000, percentOff(2000)), line(1000, 9950, NO_DISCOUNT)],
      taxContext: { chargesGst: false },
      roundOffToNearestRupee: false,
    });
    expect(totals.supplyType).toBeNull();
    expect(totals).toMatchObject({
      grossPaise: 159950,
      discountPaise: 30000,
      taxablePaise: 129950,
      totalTaxPaise: 0,
      grandTotalPaise: 129950,
      rateSummary: [],
    });
  });

  it("free item (zero price) and 100% discount produce zero values", () => {
    const totals = calculateDocumentTotals({
      lines: [
        line(1000, 0, NO_DISCOUNT, taxable("18")),
        line(1000, 50000, percentOff(10000), taxable("18")),
      ],
      taxContext: maharashtraSeller({ kind: "state", stateCode: "27" }),
      roundOffToNearestRupee: true,
    });
    expect(totals).toMatchObject({
      grossPaise: 50000,
      discountPaise: 50000,
      taxablePaise: 0,
      totalTaxPaise: 0,
      grandTotalPaise: 0,
      roundOffPaise: 0,
    });
  });

  it("handles crore-level amounts exactly", () => {
    /*   10 × ₹2,50,00,000.00 = ₹25,00,00,000.00 (25 crore), 5% off = ₹1,25,00,000.00
     *   taxable ₹23,75,00,000.00 · IGST 18% = ₹4,27,50,000.00 · total ₹28,02,50,000.00 */
    const totals = calculateDocumentTotals({
      lines: [line(10_000, 2_500_000_000, percentOff(500), taxable("18"))],
      taxContext: maharashtraSeller({ kind: "state", stateCode: "07" }),
      roundOffToNearestRupee: true,
    });
    expect(totals).toMatchObject({
      grossPaise: 25_000_000_000,
      discountPaise: 1_250_000_000,
      taxablePaise: 23_750_000_000,
      igstPaise: 4_275_000_000,
      grandTotalPaise: 28_025_000_000,
      roundOffPaise: 0,
    });
  });
});

describe("calculateDocumentTotals — validation", () => {
  const intra = maharashtraSeller({ kind: "state", stateCode: "27" });

  it("requires at least one line", () => {
    const error = errorOf(() =>
      calculateDocumentTotals({ lines: [], taxContext: intra, roundOffToNearestRupee: false }),
    );
    expect(error).toMatchObject({ code: "required", field: "lines" });
  });

  it("requires a tax treatment on every line when GST is charged", () => {
    const error = errorOf(() =>
      calculateDocumentTotals({
        lines: [line(1000, 100, NO_DISCOUNT, taxable("18")), line(1000, 100, NO_DISCOUNT)],
        taxContext: intra,
        roundOffToNearestRupee: false,
      }),
    );
    expect(error).toMatchObject({ code: "required", field: "lines[1].tax" });
  });

  it("refuses GST on a document that does not charge GST", () => {
    const error = errorOf(() =>
      calculateDocumentTotals({
        lines: [line(1000, 100, NO_DISCOUNT, taxable("18"))],
        taxContext: { chargesGst: false },
        roundOffToNearestRupee: false,
      }),
    );
    expect(error).toMatchObject({ code: "not_allowed", field: "lines[0].tax" });
  });

  it("refuses every tax treatment on a no-GST document, even on a later line", () => {
    const treatments: LineItemInput["tax"][] = [
      taxable("5"),
      { treatment: "nil-rated" },
      { treatment: "exempt" },
      { treatment: "non-gst" },
      { treatment: "zero-rated-lut" },
    ];
    for (const tax of treatments) {
      const error = errorOf(() =>
        calculateDocumentTotals({
          lines: [line(1000, 100, NO_DISCOUNT), line(1000, 100, NO_DISCOUNT, tax)],
          taxContext: { chargesGst: false },
          roundOffToNearestRupee: false,
        }),
      );
      expect(error).toMatchObject({ code: "not_allowed", field: "lines[1].tax" });
    }
  });

  it.each([
    ["40", "unknown_state"], // not a state code
    ["7", "unknown_state"], // malformed
    ["MH", "unknown_state"], // letters, not a code
    ["28", "unsupported_state"], // legacy Andhra Pradesh code
  ])("rejects seller state %j with %s", (sellerStateCode, code) => {
    const error = errorOf(() =>
      calculateDocumentTotals({
        lines: [line(1000, 100, NO_DISCOUNT, taxable("18"))],
        taxContext: {
          chargesGst: true,
          sellerStateCode,
          placeOfSupply: { kind: "state", stateCode: "27" },
        },
        roundOffToNearestRupee: false,
      }),
    );
    expect(error).toMatchObject({ code, field: "sellerStateCode" });
    expect(error.message.length).toBeGreaterThan(10);
  });

  it.each([
    ["99", "unknown_state"], // Centre Jurisdiction is not a place of supply
    ["96", "unknown_state"], // foreign country must use "outside India"
    ["25", "unsupported_state"], // legacy Daman and Diu code
  ])("rejects place-of-supply state %j with %s", (stateCode, code) => {
    const error = errorOf(() =>
      calculateDocumentTotals({
        lines: [line(1000, 100, NO_DISCOUNT, taxable("18"))],
        taxContext: maharashtraSeller({ kind: "state", stateCode }),
        roundOffToNearestRupee: false,
      }),
    );
    expect(error).toMatchObject({ code, field: "placeOfSupply.stateCode" });
  });

  it("rejects a missing place of supply", () => {
    const error = errorOf(() =>
      calculateDocumentTotals({
        lines: [line(1000, 100, NO_DISCOUNT, taxable("18"))],
        // Simulates untyped input (e.g. from a form) where the field is absent.
        taxContext: { chargesGst: true, sellerStateCode: "27" } as unknown as TaxContext,
        roundOffToNearestRupee: false,
      }),
    );
    expect(error).toMatchObject({ code: "required", field: "placeOfSupply" });
  });

  it("refuses LUT zero-rating for a domestic supply", () => {
    for (const stateCode of ["27", "29"]) {
      const error = errorOf(() =>
        calculateDocumentTotals({
          lines: [line(1000, 100, NO_DISCOUNT, { treatment: "zero-rated-lut" })],
          taxContext: maharashtraSeller({ kind: "state", stateCode }),
          roundOffToNearestRupee: false,
        }),
      );
      expect(error).toMatchObject({ code: "not_allowed", field: "lines[0].tax" });
    }
  });

  it("allows LUT zero-rating for an SEZ supply", () => {
    const totals = calculateDocumentTotals({
      lines: [line(1000, 100000, NO_DISCOUNT, { treatment: "zero-rated-lut" })],
      taxContext: maharashtraSeller({ kind: "state", stateCode: "27", recipientIsSez: true }),
      roundOffToNearestRupee: false,
    });
    expect(totals.totalTaxPaise).toBe(0);
  });

  it("rejects an unconfigured GST rate", () => {
    const error = errorOf(() =>
      calculateDocumentTotals({
        lines: [line(1000, 100, NO_DISCOUNT, taxable("12" as GstRateId))],
        taxContext: intra,
        roundOffToNearestRupee: false,
      }),
    );
    expect(error).toMatchObject({ code: "unknown_gst_rate", field: "lines[0].tax.rateId" });
  });

  it("rejects a discount larger than the line value, with the line's field path", () => {
    const error = errorOf(() =>
      calculateDocumentTotals({
        lines: [
          line(1000, 100, NO_DISCOUNT, taxable("18")),
          line(2000, 1000, amountOff(2001), taxable("18")),
        ],
        taxContext: intra,
        roundOffToNearestRupee: false,
      }),
    );
    expect(error).toMatchObject({ code: "discount_exceeds_amount", field: "lines[1].discount" });
  });

  it("rejects invalid quantities and prices", () => {
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          lines: [line(0, 100, NO_DISCOUNT)],
          taxContext: { chargesGst: false },
          roundOffToNearestRupee: false,
        }),
      ),
    ).toMatchObject({ code: "out_of_range", field: "lines[0].quantity" });
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          lines: [line(1000, -5, NO_DISCOUNT)],
          taxContext: { chargesGst: false },
          roundOffToNearestRupee: false,
        }),
      ),
    ).toMatchObject({ code: "negative", field: "lines[0].unitPrice" });
  });

  it("rejects missing seller state and place of supply", () => {
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          lines: [line(1000, 100, NO_DISCOUNT, taxable("18"))],
          taxContext: {
            chargesGst: true,
            sellerStateCode: "",
            placeOfSupply: { kind: "state", stateCode: "27" },
          },
          roundOffToNearestRupee: false,
        }),
      ),
    ).toMatchObject({ code: "required", field: "sellerStateCode" });
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          lines: [line(1000, 100, NO_DISCOUNT, taxable("18"))],
          taxContext: {
            chargesGst: true,
            sellerStateCode: "27",
            placeOfSupply: { kind: "state", stateCode: "" },
          },
          roundOffToNearestRupee: false,
        }),
      ),
    ).toMatchObject({ code: "required", field: "placeOfSupply.stateCode" });
  });

  it("checks that the seller GSTIN matches the seller state", () => {
    const base = {
      lines: [line(1000, 100000, NO_DISCOUNT, taxable("18"))],
      roundOffToNearestRupee: false,
    };
    // Valid Maharashtra GSTIN with Maharashtra seller → OK
    expect(
      calculateDocumentTotals({
        ...base,
        taxContext: {
          chargesGst: true,
          sellerStateCode: "27",
          sellerGstin: "27AAPFU0939F1ZV",
          placeOfSupply: { kind: "state", stateCode: "27" },
        },
      }).grandTotalPaise,
    ).toBe(118000);
    // Delhi GSTIN with Maharashtra seller state → rejected
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          ...base,
          taxContext: {
            chargesGst: true,
            sellerStateCode: "27",
            sellerGstin: "07AAACR5055K1Z9",
            placeOfSupply: { kind: "state", stateCode: "27" },
          },
        }),
      ),
    ).toMatchObject({ code: "not_allowed", field: "sellerGstin" });
    // Malformed GSTIN → rejected
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          ...base,
          taxContext: {
            chargesGst: true,
            sellerStateCode: "27",
            sellerGstin: "27AAPFU0939F1ZA",
            placeOfSupply: { kind: "state", stateCode: "27" },
          },
        }),
      ),
    ).toMatchObject({ code: "invalid_gstin", field: "sellerGstin" });
  });

  it("rejects line values and totals above the supported maximum", () => {
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          lines: [line(2000, MAX_AMOUNT_PAISE, NO_DISCOUNT)],
          taxContext: { chargesGst: false },
          roundOffToNearestRupee: false,
        }),
      ),
    ).toMatchObject({ code: "too_large", field: "lines[0].quantity" });
    expect(
      errorOf(() =>
        calculateDocumentTotals({
          lines: [line(1000, MAX_AMOUNT_PAISE, NO_DISCOUNT), line(1000, 1, NO_DISCOUNT)],
          taxContext: { chargesGst: false },
          roundOffToNearestRupee: false,
        }),
      ),
    ).toMatchObject({ code: "too_large" });
  });
});
