import { describe, expect, it } from "vitest";

import { mulDivRoundHalfUp } from "@/lib/money/rounding";

describe("mulDivRoundHalfUp (round half up)", () => {
  it.each([
    // value, multiplier, divisor, expected   (exact result in comment)
    [0n, 5n, 10n, 0n], // 0
    [4n, 1n, 10n, 0n], // 0.4
    [5n, 1n, 10n, 1n], // 0.5  → rounds up
    [6n, 1n, 10n, 1n], // 0.6
    [14n, 1n, 10n, 1n], // 1.4
    [15n, 1n, 10n, 2n], // 1.5  → rounds up
    [25n, 1n, 10n, 3n], // 2.5  → rounds up (not to even)
    [49n, 1n, 100n, 0n], // 0.49
    [50n, 1n, 100n, 1n], // 0.50
    [9999n, 1800n, 10000n, 1800n], // 1799.82
    [3n, 1800n, 10000n, 1n], // 0.54
    [3n, 1800n, 20000n, 0n], // 0.27
    [10n, 500n, 10000n, 1n], // 0.5
    [9n, 500n, 10000n, 0n], // 0.45
  ])("%i × %i ÷ %i = %i", (value, multiplier, divisor, expected) => {
    expect(mulDivRoundHalfUp(value, multiplier, divisor)).toBe(expected);
  });

  it("stays exact for products beyond Number.MAX_SAFE_INTEGER", () => {
    // 99,999,999,999,999 paise × 40% = 39,999,999,999,999.6 paise → rounds up to 40,000,000,000,000
    expect(mulDivRoundHalfUp(99_999_999_999_999n, 4000n, 10_000n)).toBe(40_000_000_000_000n);
  });

  it("rejects negative inputs and non-positive divisors", () => {
    expect(() => mulDivRoundHalfUp(-1n, 1n, 1n)).toThrow(RangeError);
    expect(() => mulDivRoundHalfUp(1n, -1n, 1n)).toThrow(RangeError);
    expect(() => mulDivRoundHalfUp(1n, 1n, 0n)).toThrow(RangeError);
  });
});
