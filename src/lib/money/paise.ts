import { InvalidInputError } from "@/lib/errors";
import { parseScaledDecimal } from "@/lib/money/decimal";

/**
 * An amount of money in whole paise (₹1 = 100 paise).
 *
 * This is a "branded" number: TypeScript treats it as different from a plain number,
 * so rupees, paise, percentages and quantities cannot be mixed up by accident.
 * Create values with `parseRupees` (user input) or `asPaise` (already-integer paise).
 */
declare const paiseBrand: unique symbol;
export type Paise = number & { readonly [paiseBrand]: true };

export const PAISE_PER_RUPEE = 100;

/**
 * Largest amount SmartBill accepts for any single figure: ₹9,99,99,99,99,999.99
 * (one paisa under ₹1 lakh crore). This keeps every value far inside JavaScript's exact
 * integer range and is far beyond any realistic small-business document.
 */
export const MAX_AMOUNT_PAISE = 99_999_999_999_999 as Paise;

function assertWithinLimit(value: bigint | number, field: string, label: string): void {
  if (BigInt(value) > BigInt(MAX_AMOUNT_PAISE)) {
    throw new InvalidInputError(
      "too_large",
      `${label} is larger than the maximum supported amount of ₹9,99,99,99,99,999.99.`,
      field,
    );
  }
}

/**
 * Parses a rupee amount typed by a user, e.g. "1250", "1250.5" or "1250.50", into paise.
 * Rejects negatives, more than 2 decimal places, commas, symbols and amounts over the limit.
 */
export function parseRupees(input: string | number, field = "amount", label = "Amount"): Paise {
  const paise = parseScaledDecimal(input, { decimalPlaces: 2, field, label });
  assertWithinLimit(paise, field, label);
  return Number(paise) as Paise;
}

/** Validates a value that is already in paise: a non-negative whole number within the limit. */
export function asPaise(value: number, field = "amount", label = "Amount"): Paise {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidInputError(
      "invalid_number",
      `${label} must be a whole number of paise.`,
      field,
    );
  }
  if (value < 0) {
    throw new InvalidInputError("negative", `${label} cannot be negative.`, field);
  }
  assertWithinLimit(value, field, label);
  return value as Paise;
}

/** Adds paise amounts, failing clearly if the result would exceed the supported maximum. */
export function sumPaise(values: readonly Paise[], field = "total", label = "Total"): Paise {
  let total = 0n;
  for (const value of values) total += BigInt(value);
  assertWithinLimit(total, field, label);
  return Number(total) as Paise;
}

/** Plain rupee string with exactly two decimals and no grouping, e.g. 123450 → "1234.50". */
export function paiseToRupeeString(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`Expected a whole number of paise, received ${paise}`);
  }
  const sign = paise < 0 ? "-" : "";
  const abs = BigInt(Math.abs(paise));
  const rupees = abs / 100n;
  const remainder = (abs % 100n).toString().padStart(2, "0");
  return `${sign}${rupees}.${remainder}`;
}
