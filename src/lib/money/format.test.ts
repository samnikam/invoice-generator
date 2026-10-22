import { describe, expect, it } from "vitest";

import { formatPaise } from "@/lib/money/format";

describe("formatPaise", () => {
  it("formats with the rupee symbol and two decimals", () => {
    expect(formatPaise(0)).toBe("₹0.00");
    expect(formatPaise(5)).toBe("₹0.05");
    expect(formatPaise(2714000)).toBe("₹27,140.00");
  });

  it("uses Indian digit grouping (lakh and crore)", () => {
    expect(formatPaise(10000000)).toBe("₹1,00,000.00");
    expect(formatPaise(1234567890)).toBe("₹1,23,45,678.90");
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
