import { InvalidInputError } from "@/lib/errors";
import { getActiveState, type GstState } from "@/lib/tax/states";

/**
 * GSTIN FORMAT CHECK — NOT A REGISTRATION CHECK
 * ═════════════════════════════════════════════
 * Checks that a GSTIN is well-formed. A GSTIN that passes may still be fake, cancelled,
 * suspended or belong to someone else. Only the GST portal can confirm registration.
 *
 * Supported: the standard 15-character GSTIN of a regular taxpayer:
 *   1–2   state code (must be a current code in states.ts)
 *   3–12  PAN: 5 letters, 4 digits, 1 letter
 *   13    entity number for that PAN in the state: 1–9 or A–Z
 *   14    "Z" (the default character for this format)
 *   15    check character
 * Other registration types with different layouts (e.g. UIN for embassies, non-resident
 * OIDAR, TDS/TCS) are not supported and are reported as invalid.
 *
 * Check character: the "Luhn mod 36" algorithm used by GSTN. GSTN does not publish it in
 * the Act or Rules; it was cross-checked against an open-source reference implementation
 * (Devil7-Softwares/GSTIN-Validator, Apache-2.0) and the widely published valid example
 * 27AAPFU0939F1ZV.
 */
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Computes the 15th (check) character from the first 14 characters. */
export function gstinCheckCharacter(first14: string): string {
  if (!/^[0-9A-Z]{14}$/.test(first14)) {
    throw new RangeError("Expected 14 uppercase letters or digits");
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14.charAt(i));
    // Weights alternate 1, 2, 1, 2 … from the left (equivalently 2, 1 … from the right).
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET.charAt((36 - (sum % 36)) % 36);
}

export type GstinCheck = {
  /** Uppercased, trimmed GSTIN. */
  gstin: string;
  state: GstState;
  pan: string;
};

/**
 * Validates GSTIN format, state code and check character.
 * Returns the normalised GSTIN and its state, or throws InvalidInputError.
 */
export function validateGstinFormat(input: string, field = "gstin"): GstinCheck {
  const gstin = (input ?? "").trim().toUpperCase();
  if (gstin === "") {
    throw new InvalidInputError("required", "GSTIN is required.", field);
  }
  if (gstin.length !== 15) {
    throw new InvalidInputError("invalid_gstin", "GSTIN must be exactly 15 characters.", field);
  }
  if (!GSTIN_PATTERN.test(gstin)) {
    throw new InvalidInputError(
      "invalid_gstin",
      "GSTIN format is not valid. Expected: 2-digit state code, 10-character PAN, entity number, 'Z', check character.",
      field,
    );
  }

  let state: GstState;
  try {
    state = getActiveState(gstin.slice(0, 2), field);
  } catch {
    throw new InvalidInputError(
      "invalid_gstin",
      `GSTIN starts with "${gstin.slice(0, 2)}", which is not a current GST state code.`,
      field,
    );
  }

  if (gstinCheckCharacter(gstin.slice(0, 14)) !== gstin.charAt(14)) {
    throw new InvalidInputError(
      "invalid_gstin",
      "GSTIN check character does not match. Please check for typing mistakes.",
      field,
    );
  }

  return { gstin, state, pan: gstin.slice(2, 12) };
}
