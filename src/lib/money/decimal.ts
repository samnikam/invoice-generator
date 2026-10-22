import { InvalidInputError } from "@/lib/errors";

/**
 * Strictly parses a non-negative decimal and returns it as a whole number scaled by
 * 10^decimalPlaces. Example: parseScaledDecimal("12.5", { decimalPlaces: 2 }) → 1250n.
 *
 * Why strict: money must never be silently changed. Inputs with more decimal places than
 * allowed are rejected (not rounded), and ambiguous text such as "1,000", "1e5", ".5" or
 * "12abc" is rejected rather than guessed.
 *
 * Numbers are accepted for convenience, but they are converted through their shortest
 * string form, so floating-point artefacts are caught: 0.1 + 0.2 becomes
 * "0.30000000000000004" and is rejected for having too many decimals.
 */
export function parseScaledDecimal(
  input: string | number,
  options: { decimalPlaces: number; field: string; label: string },
): bigint {
  const { decimalPlaces, field, label } = options;

  let text: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new InvalidInputError("invalid_number", `${label} must be a valid number.`, field);
    }
    text = String(input);
    if (/e/i.test(text)) {
      throw new InvalidInputError(
        "invalid_number",
        `${label} is too large or too small to read exactly.`,
        field,
      );
    }
  } else {
    text = input.trim();
  }

  if (text === "") {
    throw new InvalidInputError("required", `${label} is required.`, field);
  }
  if (/^-\d+(\.\d+)?$/.test(text)) {
    throw new InvalidInputError("negative", `${label} cannot be negative.`, field);
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new InvalidInputError(
      "invalid_number",
      `${label} must be a number using digits and an optional decimal point (no commas or symbols).`,
      field,
    );
  }

  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";
  if (fraction.length > decimalPlaces) {
    throw new InvalidInputError(
      "too_many_decimals",
      decimalPlaces === 0
        ? `${label} must be a whole number.`
        : `${label} can have at most ${decimalPlaces} decimal place${decimalPlaces === 1 ? "" : "s"}.`,
      field,
    );
  }

  return BigInt(whole + fraction.padEnd(decimalPlaces, "0"));
}
