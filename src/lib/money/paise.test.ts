import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/lib/errors";
import {
  asPaise,
  MAX_AMOUNT_PAISE,
  paiseToRupeeString,
  parseRupees,
  sumPaise,
  type Paise,
} from "@/lib/money/paise";

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidInputError);
    expect((error as InvalidInputError).code).toBe(code);
    return;
  }
  throw new Error(`Expected InvalidInputError with code "${code}" but nothing was thrown`);
}

describe("parseRupees", () => {
  it.each([
    ["0", 0],
    ["0.00", 0],
    ["1", 100],
    ["1.5", 150],
    ["1.05", 105],
    ["0.01", 1],
    ["0.99", 99],
    ["1234.56", 123456],
    ["007", 700],
    ["  42.10  ", 4210],
    ["100000", 10000000], // one lakh rupees
    ["10000000", 1000000000], // one crore rupees
    ["999999999999.99", 99999999999999], // maximum
  ])("parses %j as %i paise", (input, expected) => {
    expect(parseRupees(input)).toBe(expected);
  });

  it.each([
    [0, 0],
    [1, 100],
    [0.1, 10],
    [12.34, 1234],
    [199.99, 19999],
  ])("parses the number %d as %i paise", (input, expected) => {
    expect(parseRupees(input)).toBe(expected);
  });

  it("rejects floating-point artefacts instead of rounding them", () => {
    expectCode(() => parseRupees(0.1 + 0.2), "too_many_decimals"); // 0.30000000000000004
    expectCode(() => parseRupees(1.005), "too_many_decimals");
  });

  it.each(["1.234", "0.001", "10.999"])("rejects more than 2 decimals: %j", (input) => {
    expectCode(() => parseRupees(input), "too_many_decimals");
  });

  it.each(["", "   "])("treats %j as missing", (input) => {
    expectCode(() => parseRupees(input), "required");
  });

  it.each(["-1", "-0.50"])("rejects negative %j", (input) => {
    expectCode(() => parseRupees(input), "negative");
  });

  it.each(["abc", "1,000", "₹100", "1e5", ".5", "5.", "1 000", "+5", "0x10", "12abc", "NaN"])(
    "rejects malformed %j",
    (input) => {
      expectCode(() => parseRupees(input), "invalid_number");
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e21])(
    "rejects the number %d",
    (input) => {
      expectCode(() => parseRupees(input), "invalid_number");
    },
  );

  it("rejects amounts above the maximum", () => {
    expectCode(() => parseRupees("1000000000000"), "too_large");
    expectCode(() => parseRupees("1000000000000.00"), "too_large");
  });

  it("reports the field and label in errors", () => {
    try {
      parseRupees("abc", "lines[0].unitPrice", "Unit price");
    } catch (error) {
      expect((error as InvalidInputError).field).toBe("lines[0].unitPrice");
      expect((error as InvalidInputError).message).toMatch(/^Unit price/);
    }
  });
});

describe("asPaise", () => {
  it("accepts zero, normal and maximum values", () => {
    expect(asPaise(0)).toBe(0);
    expect(asPaise(123456)).toBe(123456);
    expect(asPaise(99_999_999_999_999)).toBe(MAX_AMOUNT_PAISE);
  });

  it("rejects fractions, negatives, unsafe and too-large values", () => {
    expectCode(() => asPaise(10.5), "invalid_number");
    expectCode(() => asPaise(Number.NaN), "invalid_number");
    expectCode(() => asPaise(Number.MAX_SAFE_INTEGER + 1), "invalid_number");
    expectCode(() => asPaise(-1), "negative");
    expectCode(() => asPaise(100_000_000_000_000), "too_large");
  });
});

describe("sumPaise", () => {
  it("adds amounts exactly", () => {
    expect(sumPaise([10, 20] as Paise[])).toBe(30); // ₹0.10 + ₹0.20 = ₹0.30 exactly
    expect(sumPaise([] as Paise[])).toBe(0);
  });

  it("rejects totals above the maximum", () => {
    expectCode(() => sumPaise([MAX_AMOUNT_PAISE, 1 as Paise]), "too_large");
  });
});

describe("paiseToRupeeString", () => {
  it.each([
    [0, "0.00"],
    [1, "0.01"],
    [10, "0.10"],
    [100, "1.00"],
    [123450, "1234.50"],
    [99_999_999_999_999, "999999999999.99"],
    [-150, "-1.50"],
  ])("converts %i paise to %j", (input, expected) => {
    expect(paiseToRupeeString(input)).toBe(expected);
  });
});
