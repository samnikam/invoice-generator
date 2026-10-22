import { paiseToRupeeString } from "@/lib/money/paise";

/**
 * Money is always handled as a whole number of paise (₹1 = 100 paise) to avoid
 * floating-point errors such as 0.1 + 0.2 = 0.30000000000000004.
 *
 * Formatting passes an exact decimal string (e.g. "1234.50") to Intl.NumberFormat,
 * never a divided floating-point number, so very large amounts format exactly.
 */

const inrCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrNumberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise as Indian Rupees with Indian digit grouping, e.g. 12345678 → "₹1,23,456.78". */
export function formatPaise(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`Expected a whole number of paise, received ${paise}`);
  }
  return inrCurrencyFormatter.format(paiseToRupeeString(paise) as `${number}`);
}

/**
 * Same as formatPaise but without the ₹ symbol, e.g. 12345678 → "1,23,456.78".
 * Useful in table columns that already say "Amount (₹)", and for fonts without a ₹ glyph.
 */
export function formatPaiseWithoutSymbol(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`Expected a whole number of paise, received ${paise}`);
  }
  return inrNumberFormatter.format(paiseToRupeeString(paise) as `${number}`);
}
