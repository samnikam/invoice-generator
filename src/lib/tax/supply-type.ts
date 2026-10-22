import { InvalidInputError } from "@/lib/errors";
import { getActiveState, stateTaxLabel, type GstState } from "@/lib/tax/states";

/**
 * Where the supply is made (place of supply), stated explicitly by the user.
 * SmartBill never guesses this: the legal place-of-supply rules (sections 10–13 of the
 * IGST Act) depend on facts the user knows, such as delivery location or the type of
 * service.
 */
export type PlaceOfSupply =
  | {
      kind: "state";
      stateCode: string;
      /** True when the recipient is an SEZ unit or developer. */
      recipientIsSez?: boolean;
    }
  | { kind: "outside-india" };

export type SupplyType =
  | {
      kind: "intra-state";
      state: GstState;
      /** Name of the state-level tax on the invoice: SGST, or UTGST for UTs without a legislature. */
      stateTaxLabel: "SGST" | "UTGST";
    }
  | {
      kind: "inter-state";
      reason: "different-state" | "export" | "sez";
    };

/**
 * Decides whether CGST + SGST/UTGST (intra-state) or IGST (inter-state) applies.
 *
 * Rules applied:
 * - Seller state and place of supply are both required and validated; nothing is assumed.
 * - Same state/UT as the seller → intra-state.
 * - Different state/UT → inter-state.
 * - Place of supply outside India (export) → inter-state (IGST Act, section 7(5)(a)).
 * - Supply to an SEZ unit/developer → inter-state even within the same state
 *   (IGST Act, section 7(5)(b)).
 */
export function determineSupplyType(input: {
  sellerStateCode: string;
  placeOfSupply: PlaceOfSupply | undefined;
}): SupplyType {
  const sellerState = getActiveState(input.sellerStateCode, "sellerStateCode");
  const place = input.placeOfSupply;

  if (!place) {
    throw new InvalidInputError("required", "Place of supply is required.", "placeOfSupply");
  }
  if (place.kind === "outside-india") {
    return { kind: "inter-state", reason: "export" };
  }

  const placeState = getActiveState(place.stateCode, "placeOfSupply.stateCode");
  if (place.recipientIsSez) {
    return { kind: "inter-state", reason: "sez" };
  }
  if (placeState.code === sellerState.code) {
    return { kind: "intra-state", state: placeState, stateTaxLabel: stateTaxLabel(placeState) };
  }
  return { kind: "inter-state", reason: "different-state" };
}
