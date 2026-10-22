import {
  collectFieldError,
  hasErrors,
  type CalculatorOutcome,
  type FieldErrors,
} from "@/lib/calculators/outcome";
import { parsePlaceOfSupply, parseSellerState } from "@/lib/calculators/place-of-supply";
import { parseRupees, type Paise } from "@/lib/money/paise";
import { ONE_HUNDRED_PERCENT, type BasisPoints } from "@/lib/money/percent";
import { mulDivRoundHalfUp } from "@/lib/money/rounding";
import { calculateGst, type GstComponents } from "@/lib/tax/gst";
import { getGstRate, type GstRate } from "@/lib/tax/gst-rates";
import { determineSupplyType, type SupplyType } from "@/lib/tax/supply-type";

/**
 * REVERSE GST (TAX-INCLUSIVE PRICE)
 * ═════════════════════════════════
 * Assumption: the entered price ALREADY INCLUDES GST at the selected rate.
 *
 * Method:
 * 1. Amount before GST ≈ price × 100 ÷ (100 + rate), rounded half up to the paisa.
 * 2. GST is then calculated FORWARD on that amount with the same engine as invoices
 *    (calculateGst), so the figures match what an invoice for that amount would show.
 * 3. Because both steps round to whole paise, amount + GST can miss the entered price
 *    by a paisa. The neighbouring amounts (±1 paisa) are tried, and the first one whose
 *    forward calculation reproduces the entered price exactly is used. If none does,
 *    the step-1 amount is used and the difference is reported, never hidden.
 */
export type GstInclusiveSplit = GstComponents & {
  amountBeforeGstPaise: Paise;
  /** Entered price − (amount before GST + GST). 0 when the split is exact. */
  differencePaise: number;
};

export function splitGstInclusivePrice(
  pricePaise: Paise,
  rateBasisPoints: BasisPoints,
  supply: "intra-state" | "inter-state",
): GstInclusiveSplit {
  const price = BigInt(pricePaise);
  const estimate = Number(
    mulDivRoundHalfUp(
      price,
      BigInt(ONE_HUNDRED_PERCENT),
      BigInt(ONE_HUNDRED_PERCENT) + BigInt(rateBasisPoints),
    ),
  );

  const candidates = [estimate, estimate - 1, estimate + 1].filter(
    (amount) => amount >= 0 && amount <= pricePaise,
  );
  for (const amount of candidates) {
    const gst = calculateGst(amount as Paise, rateBasisPoints, supply);
    if (amount + gst.totalTaxPaise === pricePaise) {
      return { ...gst, amountBeforeGstPaise: amount as Paise, differencePaise: 0 };
    }
  }

  const gst = calculateGst(estimate as Paise, rateBasisPoints, supply);
  return {
    ...gst,
    amountBeforeGstPaise: estimate as Paise,
    differencePaise: pricePaise - (estimate + gst.totalTaxPaise),
  };
}

export type ReverseGstField = "price" | "rateId" | "sellerState" | "placeOfSupply";

export type ReverseGstInput = {
  price: string;
  rateId: string;
  /** Optional pair: leave both empty for a total-GST-only answer. */
  sellerState: string;
  placeOfSupply: string;
  recipientIsSez: boolean;
};

export type ReverseGstResult = GstInclusiveSplit & {
  pricePaise: Paise;
  rate: GstRate;
  /** null when no state information was given (no CGST/SGST/IGST breakdown). */
  supplyType: SupplyType | null;
};

export function runReverseGstCalculator(
  input: ReverseGstInput,
): CalculatorOutcome<ReverseGstField, ReverseGstResult> {
  const errors: FieldErrors<ReverseGstField> = {};

  const pricePaise = collectFieldError(errors, "price", () =>
    parseRupees(input.price, "price", "Price including GST"),
  );
  let rate: GstRate | undefined;
  if (input.rateId === "") {
    errors.rateId = "Select a GST rate.";
  } else {
    rate = collectFieldError(errors, "rateId", () => getGstRate(input.rateId, "rateId"));
  }

  // State information is optional, but must be given as a complete pair.
  const wantsBreakdown = input.sellerState !== "" || input.placeOfSupply !== "";
  let supplyType: SupplyType | null = null;
  if (wantsBreakdown) {
    const sellerStateCode = collectFieldError(errors, "sellerState", () =>
      parseSellerState(input.sellerState),
    );
    const placeOfSupply = collectFieldError(errors, "placeOfSupply", () =>
      parsePlaceOfSupply(input.placeOfSupply, input.recipientIsSez),
    );
    if (sellerStateCode !== undefined && placeOfSupply !== undefined) {
      supplyType = determineSupplyType({ sellerStateCode, placeOfSupply });
    }
  }

  if (hasErrors(errors) || pricePaise === undefined || rate === undefined) {
    return { ok: false, errors };
  }

  // Without state information, GST is worked out at the full rate in one step.
  const split = splitGstInclusivePrice(
    pricePaise,
    rate.basisPoints,
    supplyType?.kind ?? "inter-state",
  );
  return { ok: true, result: { ...split, pricePaise, rate, supplyType } };
}
