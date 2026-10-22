import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/lib/errors";
import { amountInWords, numberToIndianWords } from "@/lib/money/amount-in-words";

describe("numberToIndianWords", () => {
  it.each([
    [0, "Zero"],
    [1, "One"],
    [9, "Nine"],
    [10, "Ten"],
    [11, "Eleven"],
    [13, "Thirteen"],
    [15, "Fifteen"],
    [19, "Nineteen"],
    [20, "Twenty"],
    [21, "Twenty-One"],
    [40, "Forty"],
    [99, "Ninety-Nine"],
    [100, "One Hundred"],
    [101, "One Hundred One"],
    [110, "One Hundred Ten"],
    [999, "Nine Hundred Ninety-Nine"],
    [1000, "One Thousand"],
    [1001, "One Thousand One"],
    [1010, "One Thousand Ten"],
    [1100, "One Thousand One Hundred"],
    [9999, "Nine Thousand Nine Hundred Ninety-Nine"],
    [10000, "Ten Thousand"],
    [99999, "Ninety-Nine Thousand Nine Hundred Ninety-Nine"],
    [100000, "One Lakh"],
    [100001, "One Lakh One"],
    [150000, "One Lakh Fifty Thousand"],
    [1000000, "Ten Lakh"],
    [9999999, "Ninety-Nine Lakh Ninety-Nine Thousand Nine Hundred Ninety-Nine"],
    [10000000, "One Crore"],
    [10000001, "One Crore One"],
    [12345678, "One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight"],
    [100000000, "Ten Crore"],
    [1000000000, "One Hundred Crore"],
    [1250000000, "One Hundred Twenty-Five Crore"],
    [10000000000, "One Thousand Crore"],
    [100000000000, "Ten Thousand Crore"],
    [
      999999999999,
      "Ninety-Nine Thousand Nine Hundred Ninety-Nine Crore Ninety-Nine Lakh Ninety-Nine Thousand Nine Hundred Ninety-Nine",
    ],
  ])("%i → %s", (input, expected) => {
    expect(numberToIndianWords(input)).toBe(expected);
  });

  it("rejects negative and fractional numbers", () => {
    expect(() => numberToIndianWords(-1)).toThrow(RangeError);
    expect(() => numberToIndianWords(1.5)).toThrow(RangeError);
  });
});

describe("amountInWords", () => {
  it.each([
    [0, "Rupees Zero Only"],
    [1, "One Paisa Only"],
    [2, "Two Paise Only"],
    [50, "Fifty Paise Only"],
    [99, "Ninety-Nine Paise Only"],
    [100, "Rupees One Only"],
    [101, "Rupees One and One Paisa Only"],
    [150, "Rupees One and Fifty Paise Only"],
    [123456, "Rupees One Thousand Two Hundred Thirty-Four and Fifty-Six Paise Only"],
    [2714000, "Rupees Twenty-Seven Thousand One Hundred Forty Only"],
    [10000000, "Rupees One Lakh Only"],
    [1000000000, "Rupees One Crore Only"],
    [1000000005, "Rupees One Crore and Five Paise Only"],
    [
      99_999_999_999_999,
      "Rupees Ninety-Nine Thousand Nine Hundred Ninety-Nine Crore Ninety-Nine Lakh Ninety-Nine Thousand Nine Hundred Ninety-Nine and Ninety-Nine Paise Only",
    ],
  ])("%i paise → %s", (input, expected) => {
    expect(amountInWords(input)).toBe(expected);
  });

  it.each([
    [-1, "negative"],
    [1.5, "invalid_number"],
    [Number.NaN, "invalid_number"],
    [Number.POSITIVE_INFINITY, "invalid_number"],
    [100_000_000_000_000, "too_large"],
  ])("rejects %d with code %s", (input, code) => {
    try {
      amountInWords(input);
      throw new Error("expected an error");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidInputError);
      expect((error as InvalidInputError).code).toBe(code);
    }
  });
});
