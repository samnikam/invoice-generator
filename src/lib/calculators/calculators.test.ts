import { describe, expect, it } from "vitest";

import { runAmountWords } from "@/lib/calculators/amount-words";
import { runDiscountCalculator } from "@/lib/calculators/discount-calculator";
import { runGstCalculator, type GstCalculatorInput } from "@/lib/calculators/gst-calculator";
import {
  formatSignedPercent,
  runMarginCalculator,
  signedPercentBasisPoints,
} from "@/lib/calculators/margin-markup";
import { OUTSIDE_INDIA } from "@/lib/calculators/place-of-supply";
import {
  runReverseGstCalculator,
  splitGstInclusivePrice,
  type ReverseGstInput,
} from "@/lib/calculators/reverse-gst";
import type { Paise } from "@/lib/money/paise";
import type { BasisPoints } from "@/lib/money/percent";

/* All expected values below were worked out by hand or with Python's Decimal
   (ROUND_HALF_UP), independently of the TypeScript implementation. */

const gstInput = (overrides: Partial<GstCalculatorInput> = {}): GstCalculatorInput => ({
  amount: "1000",
  treatment: "taxable",
  rateId: "18",
  sellerState: "27",
  placeOfSupply: "27",
  recipientIsSez: false,
  ...overrides,
});

describe("GST calculator", () => {
  it("intra-state: ₹1,000 at 18% → CGST ₹90 + SGST ₹90 = ₹1,180", () => {
    const outcome = runGstCalculator(gstInput());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result).toMatchObject({
      amountPaise: 100000,
      cgstPaise: 9000,
      sgstPaise: 9000,
      igstPaise: 0,
      totalTaxPaise: 18000,
      totalWithGstPaise: 118000,
      supplyType: { kind: "intra-state", stateTaxLabel: "SGST" },
    });
  });

  it("inter-state: ₹2,499.99 at 5% → IGST ₹125.00 (124.9995 rounded) = ₹2,624.99", () => {
    const outcome = runGstCalculator(
      gstInput({ amount: "2499.99", rateId: "5", placeOfSupply: "29" }),
    );
    expect(outcome.ok && outcome.result).toMatchObject({
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 12500,
      totalTaxPaise: 12500,
      totalWithGstPaise: 262499,
      supplyType: { kind: "inter-state", reason: "different-state" },
    });
  });

  it("union territory without legislature uses UTGST", () => {
    const outcome = runGstCalculator(gstInput({ sellerState: "04", placeOfSupply: "04" }));
    expect(outcome.ok && outcome.result.supplyType).toMatchObject({ stateTaxLabel: "UTGST" });
  });

  it("export with IGST and SEZ supply are inter-state", () => {
    const exportOutcome = runGstCalculator(gstInput({ placeOfSupply: OUTSIDE_INDIA }));
    expect(exportOutcome.ok && exportOutcome.result).toMatchObject({ igstPaise: 18000 });
    const sez = runGstCalculator(gstInput({ recipientIsSez: true }));
    expect(sez.ok && sez.result).toMatchObject({ igstPaise: 18000, cgstPaise: 0 });
  });

  it("exempt and LUT supplies carry no GST; no rate is needed", () => {
    const exempt = runGstCalculator(gstInput({ treatment: "exempt", rateId: "" }));
    expect(exempt.ok && exempt.result).toMatchObject({
      totalTaxPaise: 0,
      totalWithGstPaise: 100000,
      rate: null,
    });
    const lut = runGstCalculator(
      gstInput({ treatment: "zero-rated-lut", rateId: "", placeOfSupply: OUTSIDE_INDIA }),
    );
    expect(lut.ok && lut.result).toMatchObject({ totalTaxPaise: 0 });
  });

  it("refuses LUT zero-rating for a domestic supply, against the treatment field", () => {
    const outcome = runGstCalculator(
      gstInput({ treatment: "zero-rated-lut", placeOfSupply: "29" }),
    );
    expect(outcome).toMatchObject({
      ok: false,
      errors: { treatment: expect.stringMatching(/exports or supplies to an SEZ/) },
    });
  });

  it("never assumes missing states, treatment or rate", () => {
    const outcome = runGstCalculator(
      gstInput({ treatment: "", rateId: "", sellerState: "", placeOfSupply: "" }),
    );
    expect(outcome).toEqual({
      ok: false,
      errors: {
        treatment: "Choose how GST applies to this supply.",
        sellerState: "Select the seller's state.",
        placeOfSupply: "Select the place of supply.",
      },
    });
    const noRate = runGstCalculator(gstInput({ rateId: "" }));
    expect(noRate).toEqual({ ok: false, errors: { rateId: "Select a GST rate." } });
  });

  it("rejects invalid and legacy states and unconfigured rates", () => {
    const outcome = runGstCalculator(
      gstInput({ sellerState: "28", placeOfSupply: "99", rateId: "12" }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.sellerState).toMatch(/no longer used/);
    expect(outcome.errors.placeOfSupply).toMatch(/not a recognised/);
    expect(outcome.errors.rateId).toMatch(/not a configured GST rate/);
  });

  it("rejects an SEZ place of supply outside India", () => {
    const outcome = runGstCalculator(
      gstInput({ placeOfSupply: OUTSIDE_INDIA, recipientIsSez: true }),
    );
    expect(outcome.ok === false && outcome.errors.placeOfSupply).toMatch(/SEZ/);
  });

  it.each([
    ["", /required/],
    ["-5", /cannot be negative/],
    ["10.555", /at most 2 decimal places/],
    ["1,000", /no commas/],
  ])("rejects amount %j", (amount, message) => {
    const outcome = runGstCalculator(gstInput({ amount }));
    expect(outcome.ok === false && outcome.errors.amount).toMatch(message);
  });
});

describe("Reverse GST: splitGstInclusivePrice", () => {
  const p = (n: number) => n as Paise;
  const bp = (n: number) => n as BasisPoints;

  it("₹118.00 at 18% → ₹100.00 + ₹18.00 exactly", () => {
    expect(splitGstInclusivePrice(p(11800), bp(1800), "inter-state")).toMatchObject({
      amountBeforeGstPaise: 10000,
      igstPaise: 1800,
      differencePaise: 0,
    });
  });

  it("₹1,000.00 at 18% → ₹847.46 + ₹152.54 (847.4576… rounded)", () => {
    expect(splitGstInclusivePrice(p(100000), bp(1800), "intra-state")).toMatchObject({
      amountBeforeGstPaise: 84746,
      cgstPaise: 7627,
      sgstPaise: 7627,
      totalTaxPaise: 15254,
      differencePaise: 0,
    });
  });

  it("uses the neighbouring paisa when that reproduces the price exactly (₹100.00 at 18%, intra)", () => {
    // Estimate 84.75 → CGST 7.63 + SGST 7.63 = 100.01 ✗;  84.74 → 7.63 + 7.63 = 100.00 ✓
    expect(splitGstInclusivePrice(p(10000), bp(1800), "intra-state")).toMatchObject({
      amountBeforeGstPaise: 8474,
      cgstPaise: 763,
      sgstPaise: 763,
      differencePaise: 0,
    });
  });

  it("moves up a paisa when needed (₹100.07 at 5%, intra)", () => {
    // Estimate 95.30 → 2.38 + 2.38 = 100.06 ✗;  95.31 → 2.38 + 2.38 = 100.07 ✓
    expect(splitGstInclusivePrice(p(10007), bp(500), "intra-state")).toMatchObject({
      amountBeforeGstPaise: 9531,
      totalTaxPaise: 476,
      differencePaise: 0,
    });
  });

  it("reports the difference when no exact split exists (₹100.00 at 18%, IGST)", () => {
    // 84.74 + 15.25 = 99.99;  84.75 + 15.26 = 100.01;  84.76 + 15.26 = 100.02 — none is 100.00
    expect(splitGstInclusivePrice(p(10000), bp(1800), "inter-state")).toMatchObject({
      amountBeforeGstPaise: 8475,
      igstPaise: 1526,
      differencePaise: -1,
    });
  });

  it("reports a positive difference too (₹100.10 at 18%, intra)", () => {
    expect(splitGstInclusivePrice(p(10010), bp(1800), "intra-state")).toMatchObject({
      amountBeforeGstPaise: 8483,
      cgstPaise: 763,
      differencePaise: 1,
    });
  });

  it("handles zero and large prices", () => {
    expect(splitGstInclusivePrice(p(0), bp(1800), "inter-state")).toMatchObject({
      amountBeforeGstPaise: 0,
      igstPaise: 0,
      differencePaise: 0,
    });
    // ₹1,18,00,000.00 at 18% → ₹1,00,00,000.00 + ₹18,00,000.00
    expect(splitGstInclusivePrice(p(1_180_000_000), bp(1800), "inter-state")).toMatchObject({
      amountBeforeGstPaise: 1_000_000_000,
      igstPaise: 180_000_000,
      differencePaise: 0,
    });
  });
});

describe("Reverse GST calculator form", () => {
  const input = (overrides: Partial<ReverseGstInput> = {}): ReverseGstInput => ({
    price: "1180",
    rateId: "18",
    sellerState: "",
    placeOfSupply: "",
    recipientIsSez: false,
    ...overrides,
  });

  it("gives total GST only when no state information is entered", () => {
    const outcome = runReverseGstCalculator(input());
    expect(outcome.ok && outcome.result).toMatchObject({
      supplyType: null,
      amountBeforeGstPaise: 100000,
      totalTaxPaise: 18000,
    });
  });

  it("gives a CGST/SGST breakdown when both states are entered", () => {
    const outcome = runReverseGstCalculator(input({ sellerState: "27", placeOfSupply: "27" }));
    expect(outcome.ok && outcome.result).toMatchObject({
      supplyType: { kind: "intra-state" },
      cgstPaise: 9000,
      sgstPaise: 9000,
    });
  });

  it("asks for the other state when only one is entered", () => {
    expect(runReverseGstCalculator(input({ sellerState: "27" }))).toEqual({
      ok: false,
      errors: { placeOfSupply: "Select the place of supply." },
    });
    expect(runReverseGstCalculator(input({ placeOfSupply: "29" }))).toEqual({
      ok: false,
      errors: { sellerState: "Select the seller's state." },
    });
  });

  it("requires a price and a rate", () => {
    const outcome = runReverseGstCalculator(input({ price: "", rateId: "" }));
    expect(outcome.ok === false && Object.keys(outcome.errors).sort()).toEqual(["price", "rateId"]);
  });
});

describe("Discount calculator", () => {
  it.each([
    // price, kind, value, discount (paise), final (paise)
    ["1000", "percent", "10", 10000, 90000], // ₹100 off
    ["99.99", "percent", "12.5", 1250, 8749], // 12.49875 → ₹12.50 off
    ["1999", "percent", "33.33", 66627, 133273], // 666.2667 → ₹666.27 off
    ["500", "percent", "100", 50000, 0],
    ["500", "percent", "0", 0, 50000],
    ["1000", "amount", "150.50", 15050, 84950],
    ["1000", "amount", "1000", 100000, 0],
  ] as const)("₹%s with %s discount %s", (price, kind, value, discount, final) => {
    const outcome = runDiscountCalculator({ price, kind, value });
    expect(outcome.ok && outcome.result).toMatchObject({
      discountPaise: discount,
      finalPaise: final,
    });
  });

  it.each([
    [{ price: "1000", kind: "amount", value: "1000.01" }, "value", /more than the item's value/],
    [{ price: "1000", kind: "percent", value: "100.5" }, "value", /more than 100%/],
    [{ price: "1000", kind: "percent", value: "-5" }, "value", /negative/],
    [{ price: "1000", kind: "percent", value: "12.345" }, "value", /2 decimal places/],
    [{ price: "-1", kind: "percent", value: "5" }, "price", /negative/],
    [{ price: "1000.001", kind: "amount", value: "5" }, "price", /2 decimal places/],
    [{ price: "", kind: "amount", value: "5" }, "price", /required/],
  ] as const)("rejects %j", (input, field, message) => {
    const outcome = runDiscountCalculator(input);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.errors[field]).toMatch(message);
  });
});

describe("Margin and markup calculator", () => {
  it("normal profit: cost ₹80, price ₹100 → profit ₹20, margin 20%, markup 25%", () => {
    const outcome = runMarginCalculator({ cost: "80", sellingPrice: "100" });
    expect(outcome.ok && outcome.result).toMatchObject({
      profitPaise: 2000,
      outcome: "profit",
      marginBasisPoints: 2000n,
      markupBasisPoints: 2500n,
    });
  });

  it("rounds to 2 decimals: cost ₹300, price ₹400 → margin 25.00%, markup 33.33%", () => {
    const outcome = runMarginCalculator({ cost: "300", sellingPrice: "400" });
    expect(outcome.ok && outcome.result).toMatchObject({
      marginBasisPoints: 2500n,
      markupBasisPoints: 3333n,
    });
  });

  it("rounds to 2 decimals: cost ₹7, price ₹8 → margin 12.50%, markup 14.29%", () => {
    // margin 1/8 = 12.50%;  cost 7 → markup 1/7 = 14.2857% → 14.29%
    const outcome = runMarginCalculator({ cost: "7", sellingPrice: "8" });
    expect(outcome.ok && outcome.result).toMatchObject({
      marginBasisPoints: 1250n,
      markupBasisPoints: 1429n,
    });
  });

  it("loss: cost ₹100, price ₹80 → loss ₹20, margin −25%, markup −20%", () => {
    const outcome = runMarginCalculator({ cost: "100", sellingPrice: "80" });
    expect(outcome.ok && outcome.result).toMatchObject({
      profitPaise: -2000,
      outcome: "loss",
      marginBasisPoints: -2500n,
      markupBasisPoints: -2000n,
    });
  });

  it("loss rounds symmetrically: cost ₹7, price ₹6 → margin −16.67%, markup −14.29%", () => {
    const outcome = runMarginCalculator({ cost: "7", sellingPrice: "6" });
    expect(outcome.ok && outcome.result).toMatchObject({
      marginBasisPoints: -1667n,
      markupBasisPoints: -1429n,
    });
  });

  it("break-even gives 0% for both", () => {
    const outcome = runMarginCalculator({ cost: "50", sellingPrice: "50" });
    expect(outcome.ok && outcome.result).toMatchObject({
      outcome: "break-even",
      marginBasisPoints: 0n,
      markupBasisPoints: 0n,
    });
  });

  it("zero cost: markup is not defined (null), margin is 100%", () => {
    const outcome = runMarginCalculator({ cost: "0", sellingPrice: "100" });
    expect(outcome.ok && outcome.result).toMatchObject({
      marginBasisPoints: 10000n,
      markupBasisPoints: null,
    });
  });

  it("zero selling price: margin is not defined (null), markup is −100%", () => {
    const outcome = runMarginCalculator({ cost: "100", sellingPrice: "0" });
    expect(outcome.ok && outcome.result).toMatchObject({
      marginBasisPoints: null,
      markupBasisPoints: -10000n,
    });
  });

  it("both zero: neither percentage is defined", () => {
    const outcome = runMarginCalculator({ cost: "0", sellingPrice: "0" });
    expect(outcome.ok && outcome.result).toMatchObject({
      outcome: "break-even",
      marginBasisPoints: null,
      markupBasisPoints: null,
    });
  });

  it("very large markup stays exact: cost ₹0.01, price ₹1,00,00,000 → 99,99,99,99,900%", () => {
    // profit 999,999,999 paise ÷ 1 paisa × 100 = 99,999,999,900%
    const outcome = runMarginCalculator({ cost: "0.01", sellingPrice: "10000000" });
    expect(outcome.ok && outcome.result.markupBasisPoints).toBe(9_999_999_990_000n);
  });

  it("rejects invalid values", () => {
    const outcome = runMarginCalculator({ cost: "-1", sellingPrice: "abc" });
    expect(outcome.ok === false && outcome.errors).toMatchObject({
      cost: expect.stringMatching(/negative/),
      sellingPrice: expect.stringMatching(/must be a number/),
    });
  });

  it("formats signed percentages", () => {
    expect(formatSignedPercent(2000n)).toBe("20.00%");
    expect(formatSignedPercent(3333n)).toBe("33.33%");
    expect(formatSignedPercent(-2500n)).toBe("−25.00%");
    expect(formatSignedPercent(5n)).toBe("0.05%");
    expect(formatSignedPercent(0n)).toBe("0.00%");
    expect(formatSignedPercent(9_999_999_990_000n)).toBe("99,999,999,900.00%");
  });

  it("never divides by zero", () => {
    expect(signedPercentBasisPoints(100, 0)).toBeNull();
    expect(signedPercentBasisPoints(0, 0)).toBeNull();
  });
});

describe("Amount to words", () => {
  it.each([
    ["0", "Rupees Zero Only"],
    ["0.5", "Fifty Paise Only"],
    ["1", "Rupees One Only"],
    ["1234.56", "Rupees One Thousand Two Hundred Thirty-Four and Fifty-Six Paise Only"],
    ["150000", "Rupees One Lakh Fifty Thousand Only"],
    ["10000000", "Rupees One Crore Only"],
  ])("%j → %s", (amount, words) => {
    const outcome = runAmountWords({ amount });
    expect(outcome.ok && outcome.result.words).toBe(words);
  });

  it.each([
    ["", /required/],
    ["abc", /must be a number/],
    ["-10", /negative/],
    ["1.234", /2 decimal places/],
    ["1000000000000", /maximum supported amount/],
  ])("rejects %j", (amount, message) => {
    const outcome = runAmountWords({ amount });
    expect(outcome.ok === false && outcome.errors.amount).toMatch(message);
  });
});
