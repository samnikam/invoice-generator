import { validateGstinFormat } from "@/lib/tax/gstin";
import type { GstState } from "@/lib/tax/states";

/**
 * PLACE-OF-SUPPLY SUGGESTION FROM THE CUSTOMER'S GSTIN
 * The first two digits of a GSTIN are the state where the customer is REGISTERED. That is
 * often, but not always, the correct place of supply (it depends on the transaction), so
 * this only ever produces a suggestion for the user to accept or ignore. It never changes
 * the place of supply, GST treatment or any calculation by itself.
 *
 * Works offline: it reuses the existing GSTIN check (format, current state code and check
 * character), so an incomplete or mistyped GSTIN never produces a suggestion.
 */
export type PlaceOfSupplySuggestion =
  /** The place of supply is empty or different from the GSTIN's state. */
  | { kind: "suggest"; state: GstState; placeOfSupplyChosen: boolean }
  /** The place of supply already matches the GSTIN's state. */
  | { kind: "matches"; state: GstState };

export function placeOfSupplySuggestion(
  customerGstin: string,
  placeOfSupply: string,
): PlaceOfSupplySuggestion | null {
  if (customerGstin.trim() === "") return null;
  let state: GstState;
  try {
    state = validateGstinFormat(customerGstin).state;
  } catch {
    return null; // incomplete or invalid GSTIN: no suggestion
  }
  const chosen = placeOfSupply.trim();
  return chosen === state.code
    ? { kind: "matches", state }
    : { kind: "suggest", state, placeOfSupplyChosen: chosen !== "" };
}
