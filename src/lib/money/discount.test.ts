import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/lib/errors";
import { applyDiscount, calculateDiscount, NO_DISCOUNT } from "@/lib/money/discount";
import type { Paise } from "@/lib/money/paise";
import type { BasisPoints } from "@/lib/money/percent";

const p = (n: number) => n as Paise;
const pct = (bp: number) => ({ kind: "percent", basisPoints: bp as BasisPoints }) as const;
const fixed = (n: number) => ({ kind: "amount", paise: n as Paise }) as const;

describe("calculateDiscount", () => {
  it("returns zero for no discount", () => {
    expect(calculateDiscount(p(100000), NO_DISCOUNT)).toBe(0);
  });

  it.each([
    // line value (paise), percent (bp), expected discount (paise)
    [100000, 1000, 10000], // ₹1,000 at 10% = ₹100.00
    [9999, 1250, 1250], // ₹99.99 at 12.5% = 1,249.875 paise → 1,250
    [10, 500, 1], // ₹0.10 at 5% = 0.5 paise → rounds up to 1
    [9, 500, 0], // ₹0.09 at 5% = 0.45 paise → rounds down to 0
    [33333, 3333, 11110], // ₹333.33 at 33.33% = 11,109.8889 → 11,110
    [250000, 10000, 250000], // 100% discount
    [250000, 0, 0], // 0% discount
    [0, 1000, 0], // free item
  ])("%i paise at %i bp → %i paise", (amount, bp, expected) => {
    expect(calculateDiscount(p(amount), pct(bp))).toBe(expected);
  });

  it("accepts a fixed discount up to the line value", () => {
    expect(calculateDiscount(p(50000), fixed(5000))).toBe(5000);
    expect(calculateDiscount(p(50000), fixed(50000))).toBe(50000);
    expect(calculateDiscount(p(50000), fixed(0))).toBe(0);
  });

  it("rejects a fixed discount larger than the line value", () => {
    try {
      calculateDiscount(p(50000), fixed(50001), "lines[1].discount");
      throw new Error("expected an error");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidInputError);
      expect((error as InvalidInputError).code).toBe("discount_exceeds_amount");
      expect((error as InvalidInputError).field).toBe("lines[1].discount");
    }
  });

  it("rejects invalid discount values", () => {
    expect(() => calculateDiscount(p(1000), pct(10001))).toThrow(InvalidInputError);
    expect(() => calculateDiscount(p(1000), pct(-1))).toThrow(InvalidInputError);
    expect(() => calculateDiscount(p(1000), fixed(-1))).toThrow(InvalidInputError);
    expect(() => calculateDiscount(p(1000), fixed(1.5))).toThrow(InvalidInputError);
    expect(() => calculateDiscount(p(-1000), NO_DISCOUNT)).toThrow(InvalidInputError);
  });
});

describe("applyDiscount", () => {
  it("returns the discount and the value after discount (the taxable value)", () => {
    expect(applyDiscount(p(250000), pct(1000))).toEqual({
      discountPaise: 25000,
      afterDiscountPaise: 225000,
    });
    expect(applyDiscount(p(50000), fixed(5000))).toEqual({
      discountPaise: 5000,
      afterDiscountPaise: 45000,
    });
  });
});
