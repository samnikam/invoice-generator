import { InvalidInputError } from "@/lib/errors";
import { parseScaledDecimal } from "@/lib/money/decimal";

/**
 * A percentage stored as a whole number of basis points: 1% = 100 basis points.
 * Examples: 18% = 1800, 12.5% = 1250, 0.25% = 25.
 * Whole numbers avoid floating-point errors in rate arithmetic.
 */
declare const basisPointsBrand: unique symbol;
export type BasisPoints = number & { readonly [basisPointsBrand]: true };

export const BASIS_POINTS_PER_PERCENT = 100;
export const ONE_HUNDRED_PERCENT = 10_000 as BasisPoints;

/** Parses a percentage typed by a user ("12.5" → 1250 basis points). Range 0–100%, max 2 decimals. */
export function parsePercent(
  input: string | number,
  field = "percent",
  label = "Percentage",
): BasisPoints {
  const basisPoints = parseScaledDecimal(input, { decimalPlaces: 2, field, label });
  if (basisPoints > BigInt(ONE_HUNDRED_PERCENT)) {
    throw new InvalidInputError("out_of_range", `${label} cannot be more than 100%.`, field);
  }
  return Number(basisPoints) as BasisPoints;
}

/** Validates a value already in basis points (whole number, 0–10,000). */
export function asBasisPoints(value: number, field = "percent", label = "Percentage"): BasisPoints {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidInputError(
      "invalid_number",
      `${label} must be a whole number of basis points.`,
      field,
    );
  }
  if (value < 0) {
    throw new InvalidInputError("negative", `${label} cannot be negative.`, field);
  }
  if (value > ONE_HUNDRED_PERCENT) {
    throw new InvalidInputError("out_of_range", `${label} cannot be more than 100%.`, field);
  }
  return value as BasisPoints;
}

/** Formats basis points as a percentage without trailing zeros: 1250 → "12.5", 1800 → "18". */
export function formatBasisPointsAsPercent(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = String(basisPoints % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/**
 * Formats HALF of a rate as a percentage, e.g. for CGST and SGST labels:
 * 1800 → "9", 500 → "2.5", 150 → "0.75", 25 → "0.125". Exact (no floating point).
 */
export function formatHalfRatePercent(basisPoints: number): string {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new RangeError(`Expected non-negative whole basis points, received ${basisPoints}`);
  }
  // Half a basis point is 0.005%, so work in thousandths of a percent: bp × 10 ÷ 2.
  const thousandths = basisPoints * 5;
  const whole = Math.trunc(thousandths / 1000);
  const fraction = String(thousandths % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}
