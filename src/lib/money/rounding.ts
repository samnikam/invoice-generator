/**
 * SMARTBILL ROUNDING POLICY
 * ─────────────────────────
 * 1. All money is held as whole paise. Fractions of a paisa only appear inside a single
 *    calculation (e.g. quantity × price, or amount × rate) and are rounded immediately.
 * 2. Rounding rule: ROUND HALF UP to the nearest paisa (0.5 paisa → 1 paisa,
 *    0.49 paisa → 0). Every amount the engine rounds is non-negative, so this is the
 *    same as "half away from zero".
 * 3. Each displayed component is rounded exactly once, at line level:
 *    line value, line discount, and each line's CGST / SGST / IGST.
 *    Document totals are plain sums of the rounded line figures, so the lines on an
 *    invoice always add up to its totals.
 * 4. The optional invoice "round off" to the nearest rupee (also half up) is applied
 *    only to the final total and shown as a separate signed amount.
 *
 * The arithmetic below uses BigInt so that intermediate products (e.g. a large amount
 * × a tax rate) are exact and can never lose precision.
 */

/**
 * Returns round_half_up(value × multiplier ÷ divisor) for non-negative integers.
 * Example: mulDivRoundHalfUp(5n, 1n, 10n) === 1n (0.5 rounds up).
 */
export function mulDivRoundHalfUp(value: bigint, multiplier: bigint, divisor: bigint): bigint {
  if (value < 0n || multiplier < 0n) {
    throw new RangeError("mulDivRoundHalfUp only supports non-negative values");
  }
  if (divisor <= 0n) {
    throw new RangeError("mulDivRoundHalfUp requires a positive divisor");
  }
  const product = value * multiplier;
  // floor((2 × product + divisor) / (2 × divisor)) is exact half-up rounding of product / divisor.
  return (2n * product + divisor) / (2n * divisor);
}
