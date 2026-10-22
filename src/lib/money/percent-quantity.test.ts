import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/lib/errors";
import { asBasisPoints, formatBasisPointsAsPercent, parsePercent } from "@/lib/money/percent";
import { formatQuantity, parseQuantity } from "@/lib/money/quantity";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof InvalidInputError ? error.code : "not-InvalidInputError";
  }
  return undefined;
}

describe("parsePercent", () => {
  it.each([
    ["0", 0],
    ["5", 500],
    ["12.5", 1250],
    ["0.25", 25],
    ["18", 1800],
    ["99.99", 9999],
    ["100", 10000],
  ])("%j%% → %i basis points", (input, expected) => {
    expect(parsePercent(input)).toBe(expected);
  });

  it("rejects invalid percentages", () => {
    expect(codeOf(() => parsePercent("100.01"))).toBe("out_of_range");
    expect(codeOf(() => parsePercent("150"))).toBe("out_of_range");
    expect(codeOf(() => parsePercent("12.345"))).toBe("too_many_decimals");
    expect(codeOf(() => parsePercent("-5"))).toBe("negative");
    expect(codeOf(() => parsePercent("10%"))).toBe("invalid_number");
    expect(codeOf(() => parsePercent(""))).toBe("required");
  });

  it("validates raw basis points", () => {
    expect(asBasisPoints(1800)).toBe(1800);
    expect(codeOf(() => asBasisPoints(10001))).toBe("out_of_range");
    expect(codeOf(() => asBasisPoints(-1))).toBe("negative");
    expect(codeOf(() => asBasisPoints(12.5))).toBe("invalid_number");
  });

  it.each([
    [1800, "18"],
    [1250, "12.5"],
    [25, "0.25"],
    [150, "1.5"],
    [0, "0"],
    [10000, "100"],
  ])("formats %i basis points as %j", (input, expected) => {
    expect(formatBasisPointsAsPercent(input)).toBe(expected);
  });
});

describe("parseQuantity", () => {
  it.each([
    ["1", 1000],
    ["2.5", 2500],
    ["0.125", 125],
    ["0.001", 1],
    ["10000000", 10_000_000_000],
  ])("%j → %i thousandths", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  it("rejects invalid quantities", () => {
    expect(codeOf(() => parseQuantity("0"))).toBe("out_of_range");
    expect(codeOf(() => parseQuantity("0.000"))).toBe("out_of_range");
    expect(codeOf(() => parseQuantity("1.2345"))).toBe("too_many_decimals");
    expect(codeOf(() => parseQuantity("-1"))).toBe("negative");
    expect(codeOf(() => parseQuantity("10000000.001"))).toBe("too_large");
    expect(codeOf(() => parseQuantity("two"))).toBe("invalid_number");
  });

  it.each([
    [1000, "1"],
    [2500, "2.5"],
    [125, "0.125"],
    [1, "0.001"],
  ])("formats %i thousandths as %j", (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
  });
});
