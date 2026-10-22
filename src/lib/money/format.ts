/**
 * Money is always handled as a whole number of paise (₹1 = 100 paise) to avoid
 * floating-point errors such as 0.1 + 0.2 = 0.30000000000000004.
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise as Indian Rupees with Indian digit grouping, e.g. 12345678 → "₹1,23,456.78". */
export function formatPaise(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`Expected a whole number of paise, received ${paise}`);
  }
  return inrFormatter.format(paise / 100);
}
