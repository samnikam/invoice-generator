import { InvalidInputError } from "@/lib/errors";
import { getActiveState } from "@/lib/tax/states";
import type { PlaceOfSupply } from "@/lib/tax/supply-type";

/** Form value used for an export, alongside the two-digit state codes. */
export const OUTSIDE_INDIA = "outside-india";

/**
 * Converts the place-of-supply form value into the engine's PlaceOfSupply.
 * The value is either a state code ("27") or OUTSIDE_INDIA. Nothing is assumed:
 * an empty value is an error.
 */
export function parsePlaceOfSupply(value: string, recipientIsSez: boolean): PlaceOfSupply {
  if (value.trim() === "") {
    throw new InvalidInputError("required", "Select the place of supply.", "placeOfSupply");
  }
  if (value === OUTSIDE_INDIA) {
    if (recipientIsSez) {
      throw new InvalidInputError(
        "not_allowed",
        "An SEZ supply has a place of supply in India. Choose the SEZ's state instead.",
        "placeOfSupply",
      );
    }
    return { kind: "outside-india" };
  }
  const state = getActiveState(value, "placeOfSupply");
  return { kind: "state", stateCode: state.code, recipientIsSez };
}

/** Validates the seller state form value, with a form-friendly message when empty. */
export function parseSellerState(value: string): string {
  if (value.trim() === "") {
    throw new InvalidInputError("required", "Select the seller's state.", "sellerState");
  }
  return getActiveState(value, "sellerState").code;
}
