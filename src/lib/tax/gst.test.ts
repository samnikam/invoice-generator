import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/lib/errors";
import type { Paise } from "@/lib/money/paise";
import type { BasisPoints } from "@/lib/money/percent";
import { calculateGst } from "@/lib/tax/gst";
import { GST_RATE_REVIEW, GST_RATES, getGstRate } from "@/lib/tax/gst-rates";

const p = (n: number) => n as Paise;
const bp = (n: number) => n as BasisPoints;

/**
 * Hand-calculated GST on a taxable value of ₹10,000.00 (1,000,000 paise) for every
 * configured rate. Adding or changing a rate in gst-rates.ts makes the completeness test
 * fail until this table is updated with independently worked figures.
 */
const EXPECTED_ON_TEN_THOUSAND: Record<string, { igst: number; cgst: number }> = {
  "5": { igst: 50_000, cgst: 25_000 }, //   ₹500.00 = ₹250.00 + ₹250.00
  "18": { igst: 180_000, cgst: 90_000 }, // ₹1,800.00 = ₹900.00 + ₹900.00
  "40": { igst: 400_000, cgst: 200_000 }, // ₹4,000.00 = ₹2,000.00 + ₹2,000.00
  "3": { igst: 30_000, cgst: 15_000 }, //   ₹300.00 = ₹150.00 + ₹150.00
  "1.5": { igst: 15_000, cgst: 7_500 }, //  ₹150.00 = ₹75.00 + ₹75.00
  "0.25": { igst: 2_500, cgst: 1_250 }, //  ₹25.00 = ₹12.50 + ₹12.50
};

describe("GST rate configuration", () => {
  it("is marked provisional, not verified, with a research date", () => {
    expect(GST_RATE_REVIEW.status).toBe("provisional");
    expect(GST_RATE_REVIEW.verifiedByTaxProfessional).toBe(false);
    expect(GST_RATE_REVIEW.researchedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("provides a user notice that does not present the rates as verified", () => {
    const notice = GST_RATE_REVIEW.userNotice;
    expect(notice).toMatch(/not been verified/);
    expect(notice).toMatch(/HSN\/SAC/);
    expect(notice).toMatch(/confirm the rate/);
    expect(notice).not.toMatch(/compliant|certified|official/i);
  });

  it("has unique ids and valid rates", () => {
    const ids = GST_RATES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rate of GST_RATES) {
      expect(Number.isInteger(rate.basisPoints)).toBe(true);
      expect(rate.basisPoints).toBeGreaterThan(0);
      expect(rate.basisPoints).toBeLessThanOrEqual(10_000);
      // The id and label must describe the same rate as basisPoints.
      expect(Number(rate.id) * 100).toBe(rate.basisPoints);
      expect(rate.label).toBe(`${rate.id}%`);
    }
  });

  it("does not include a 0% rate (nil/exempt/non-GST are treatments, not rates)", () => {
    expect(GST_RATES.some((r) => r.basisPoints === 0)).toBe(false);
  });

  it("has hand-checked expected values for every configured rate", () => {
    expect(GST_RATES.map((r) => r.id).sort()).toEqual(Object.keys(EXPECTED_ON_TEN_THOUSAND).sort());
  });

  it("looks up rates and rejects unknown ones", () => {
    expect(getGstRate("18").basisPoints).toBe(1800);
    for (const unknown of ["12", "28", "0", "", "18%"]) {
      try {
        getGstRate(unknown);
        throw new Error("expected an error");
      } catch (error) {
        expect((error as InvalidInputError).code).toBe("unknown_gst_rate");
      }
    }
  });
});

describe("calculateGst", () => {
  describe.each(GST_RATES.map((r) => [r.label, r] as const))("at %s on ₹10,000", (_label, rate) => {
    const expected = EXPECTED_ON_TEN_THOUSAND[rate.id];
    if (!expected) throw new Error(`No expected values for rate ${rate.id}`);

    it("intra-state: CGST and SGST are each half, total equals full rate", () => {
      const gst = calculateGst(p(1_000_000), rate.basisPoints, "intra-state");
      expect(gst).toEqual({
        cgstPaise: expected.cgst,
        sgstPaise: expected.cgst,
        igstPaise: 0,
        totalTaxPaise: expected.igst,
      });
    });

    it("inter-state: IGST at the full rate", () => {
      const gst = calculateGst(p(1_000_000), rate.basisPoints, "inter-state");
      expect(gst).toEqual({
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: expected.igst,
        totalTaxPaise: expected.igst,
      });
    });
  });

  it("rounds each component half up to the nearest paisa", () => {
    // ₹99.99 at 18%: IGST 1,799.82 → 1,800; CGST 899.91 → 900 each.
    expect(calculateGst(p(9999), bp(1800), "inter-state").igstPaise).toBe(1800);
    expect(calculateGst(p(9999), bp(1800), "intra-state").cgstPaise).toBe(900);

    // ₹0.10 at 5%: IGST exactly 0.5 paise → 1; CGST 0.25 → 0.
    expect(calculateGst(p(10), bp(500), "inter-state").igstPaise).toBe(1);
    expect(calculateGst(p(10), bp(500), "intra-state").totalTaxPaise).toBe(0);

    // ₹2.00 at 0.25%: IGST exactly 0.5 paise → 1; CGST 0.25 → 0.
    expect(calculateGst(p(200), bp(25), "inter-state").igstPaise).toBe(1);
    expect(calculateGst(p(200), bp(25), "intra-state").totalTaxPaise).toBe(0);
  });

  it("documents the expected 1-paisa difference between CGST+SGST and IGST", () => {
    // ₹0.03 at 18%: IGST 0.54 → 1 paisa; CGST 0.27 → 0, SGST 0.27 → 0.
    const intra = calculateGst(p(3), bp(1800), "intra-state");
    const inter = calculateGst(p(3), bp(1800), "inter-state");
    expect(intra.totalTaxPaise).toBe(0);
    expect(inter.totalTaxPaise).toBe(1);
  });

  it("returns zero tax on a zero taxable value", () => {
    expect(calculateGst(p(0), bp(1800), "intra-state").totalTaxPaise).toBe(0);
  });

  it("handles large amounts exactly (lakhs and crores)", () => {
    // ₹1,00,000.00 at 18% = ₹18,000.00
    expect(calculateGst(p(10_000_000), bp(1800), "inter-state").igstPaise).toBe(1_800_000);
    // ₹5,00,00,00,000.00 (500 crore) at 18% = ₹90,00,00,000.00 (90 crore)
    expect(calculateGst(p(50_000_000_000), bp(1800), "inter-state").igstPaise).toBe(9_000_000_000);
    // ₹1,23,45,678.91 at 5% intra: CGST 2.5% = 3,08,641.97275 → ₹3,08,641.97
    expect(calculateGst(p(1_234_567_891), bp(500), "intra-state").cgstPaise).toBe(30_864_197);
  });

  it("rejects invalid inputs", () => {
    expect(() => calculateGst(p(-1), bp(1800), "intra-state")).toThrow(InvalidInputError);
    expect(() => calculateGst(p(1.5), bp(1800), "intra-state")).toThrow(InvalidInputError);
    expect(() => calculateGst(p(100), bp(0), "intra-state")).toThrow(InvalidInputError);
    expect(() => calculateGst(p(100), bp(10_001), "intra-state")).toThrow(InvalidInputError);
    expect(() => calculateGst(p(100), bp(12.5), "intra-state")).toThrow(InvalidInputError);
  });
});
