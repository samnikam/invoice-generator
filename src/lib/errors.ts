/**
 * Error thrown by SmartBill's business logic when an input is missing or invalid.
 *
 * `code` is stable and machine-readable (for tests and UI mapping);
 * `message` is a plain-English explanation suitable for showing to a user;
 * `field` optionally points at the input that caused the problem, e.g. "lines[2].discount".
 */
export type InputErrorCode =
  | "required"
  | "invalid_number"
  | "too_many_decimals"
  | "negative"
  | "out_of_range"
  | "too_large"
  | "discount_exceeds_amount"
  | "unknown_gst_rate"
  | "unknown_state"
  | "unsupported_state"
  | "invalid_gstin"
  | "not_allowed";

export class InvalidInputError extends Error {
  override readonly name = "InvalidInputError";

  constructor(
    readonly code: InputErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}
