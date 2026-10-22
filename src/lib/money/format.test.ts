import { describe, expect, it } from "vitest";

import { formatPaise, formatPaiseWithoutSymbol } from "@/lib/money/format";

describe("formatPaise", () => {
  it("formats with the rupee symbol and two decimals", () => {
    expect(formatPaise(0)).toBe("₹0.00");
    expect(formatPaise(5)).toBe("₹0.05");
    expect(formatPaise(2714000)).toBe("₹27,140.00");
  });

  it("uses Indian digit grouping (thousand, lakh and crore)", () => {
    expect(formatPaise(100000)).toBe("₹1,000.00");
    expect(formatPaise(10000000)).toBe("₹1,00,000.00");
    expect(formatPaise(1234567890)).toBe("₹1,23,45,678.90");
    expect(formatPaise(1000000000)).toBe("₹1,00,00,000.00");
  });

  it("formats the largest supported amount exactly", () => {
    expect(formatPaise(99_999_999_999_999)).toBe("₹9,99,99,99,99,999.99");
    expect(formatPaise(12_345_678_901_234)).toBe("₹1,23,45,67,89,012.34");
  });

  it("formats negative amounts", () => {
    expect(formatPaise(-150050)).toBe("-₹1,500.50");
  });

  it("rejects fractional paise and unsafe numbers", () => {
    expect(() => formatPaise(10.5)).toThrow(RangeError);
    expect(() => formatPaise(Number.NaN)).toThrow(RangeError);
    expect(() => formatPaise(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe("formatPaiseWithoutSymbol", () => {
  it("formats with Indian grouping and no symbol", () => {
    expect(formatPaiseWithoutSymbol(0)).toBe("0.00");
    expect(formatPaiseWithoutSymbol(1234567890)).toBe("1,23,45,678.90");
    expect(formatPaiseWithoutSymbol(99_999_999_999_999)).toBe("9,99,99,99,99,999.99");
  });
});
