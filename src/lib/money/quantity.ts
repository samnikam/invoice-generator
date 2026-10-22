import { InvalidInputError } from "@/lib/errors";
import { parseScaledDecimal } from "@/lib/money/decimal";

/**
 * A quantity stored in thousandths so fractional units (2.5 kg, 0.125 m) stay exact.
 * Examples: 1 → 1000, 2.5 → 2500, 0.125 → 125.
 */
declare const quantityBrand: unique symbol;
export type QuantityThousandths = number & { readonly [quantityBrand]: true };

export const QUANTITY_SCALE = 1000;
/** Largest quantity accepted on one line: 1,00,00,000 (one crore) units. */
export const MAX_QUANTITY_THOUSANDTHS = 10_000_000_000 as QuantityThousandths;

/** Parses a quantity typed by a user. Must be greater than zero, with at most 3 decimals. */
export function parseQuantity(
  input: string | number,
  field = "quantity",
  label = "Quantity",
): QuantityThousandths {
  const scaled = parseScaledDecimal(input, { decimalPlaces: 3, field, label });
  return asQuantityThousandths(Number(scaled), field, label);
}

/** Validates a value already in thousandths. */
export function asQuantityThousandths(
  value: number,
  field = "quantity",
  label = "Quantity",
): QuantityThousandths {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidInputError(
      "invalid_number",
      `${label} must be a whole number of thousandths.`,
      field,
    );
  }
  if (value <= 0) {
    throw new InvalidInputError("out_of_range", `${label} must be greater than zero.`, field);
  }
  if (value > MAX_QUANTITY_THOUSANDTHS) {
    throw new InvalidInputError(
      "too_large",
      `${label} cannot be more than 1,00,00,000 units on one line.`,
      field,
    );
  }
  return value as QuantityThousandths;
}

/** Formats a quantity without trailing zeros: 2500 → "2.5", 1000 → "1". */
export function formatQuantity(quantity: number): string {
  const whole = Math.trunc(quantity / QUANTITY_SCALE);
  const fraction = String(quantity % QUANTITY_SCALE)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}
