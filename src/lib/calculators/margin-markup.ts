import {
  collectFieldError,
  hasErrors,
  type CalculatorOutcome,
  type FieldErrors,
} from "@/lib/calculators/outcome";
import { parseRupees, type Paise } from "@/lib/money/paise";
import { ONE_HUNDRED_PERCENT } from "@/lib/money/percent";
import { mulDivRoundHalfUp } from "@/lib/money/rounding";

/**
 * PROFIT, MARGIN AND MARKUP
 * ═════════════════════════
 *   profit  = selling price − cost              (negative means a loss)
 *   margin  = profit ÷ selling price × 100      (share of the price that is profit)
 *   markup  = profit ÷ cost × 100               (how much was added on top of cost)
 *
 * Example: cost ₹80, price ₹100 → profit ₹20, margin 20%, markup 25%.
 *
 * Rules:
 * - Percentages are rounded to 2 decimal places, half away from zero
 *   (12.345% → 12.35%, −12.345% → −12.35%).
 * - Losses keep their sign: profit and both percentages are negative.
 * - Division by zero is never attempted: margin is "not defined" when the selling price
 *   is ₹0, and markup is "not defined" when the cost is ₹0. They are returned as null,
 *   never as Infinity or NaN.
 * - Percentages are returned as BigInt basis points (1% = 100) because markup on a tiny
 *   cost can be enormous and must not lose precision.
 */
export type MarginField = "cost" | "sellingPrice";
export type MarginInput = { cost: string; sellingPrice: string };

export type MarginResult = {
  costPaise: Paise;
  sellingPricePaise: Paise;
  /** Signed: negative for a loss. */
  profitPaise: number;
  outcome: "profit" | "loss" | "break-even";
  /** null when the selling price is zero. */
  marginBasisPoints: bigint | null;
  /** null when the cost is zero. */
  markupBasisPoints: bigint | null;
};

/** round_half_away_from_zero(numerator × 10,000 ÷ denominator), or null if denominator is 0. */
export function signedPercentBasisPoints(numerator: number, denominator: number): bigint | null {
  if (denominator === 0) return null;
  const magnitude = mulDivRoundHalfUp(
    BigInt(Math.abs(numerator)),
    BigInt(ONE_HUNDRED_PERCENT),
    BigInt(Math.abs(denominator)),
  );
  return numerator < 0 !== denominator < 0 ? -magnitude : magnitude;
}

/** Formats signed basis points with exactly 2 decimals: 1250n → "12.50%", -3333n → "−33.33%". */
export function formatSignedPercent(basisPoints: bigint): string {
  const negative = basisPoints < 0n;
  const abs = negative ? -basisPoints : basisPoints;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "−" : ""}${whole}.${fraction}%`;
}

export function runMarginCalculator(
  input: MarginInput,
): CalculatorOutcome<MarginField, MarginResult> {
  const errors: FieldErrors<MarginField> = {};
  const costPaise = collectFieldError(errors, "cost", () =>
    parseRupees(input.cost, "cost", "Cost price"),
  );
  const sellingPricePaise = collectFieldError(errors, "sellingPrice", () =>
    parseRupees(input.sellingPrice, "sellingPrice", "Selling price"),
  );
  if (hasErrors(errors) || costPaise === undefined || sellingPricePaise === undefined) {
    return { ok: false, errors };
  }

  const profitPaise = sellingPricePaise - costPaise;
  return {
    ok: true,
    result: {
      costPaise,
      sellingPricePaise,
      profitPaise,
      outcome: profitPaise > 0 ? "profit" : profitPaise < 0 ? "loss" : "break-even",
      marginBasisPoints: signedPercentBasisPoints(profitPaise, sellingPricePaise),
      markupBasisPoints: signedPercentBasisPoints(profitPaise, costPaise),
    },
  };
}
