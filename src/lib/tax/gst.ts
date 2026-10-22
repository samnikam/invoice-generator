import { InvalidInputError } from "@/lib/errors";
import { asPaise, type Paise } from "@/lib/money/paise";
import { ONE_HUNDRED_PERCENT, type BasisPoints } from "@/lib/money/percent";
import { mulDivRoundHalfUp } from "@/lib/money/rounding";

export type GstComponents = {
  cgstPaise: Paise;
  /** SGST or UTGST — the same amount; the label comes from the supply type. */
  sgstPaise: Paise;
  igstPaise: Paise;
  totalTaxPaise: Paise;
};

/**
 * Calculates GST on a taxable value (already after discount) at a total rate.
 *
 * - Intra-state: CGST and SGST/UTGST are each calculated at HALF the rate and each is
 *   rounded half up to the nearest paisa. They are therefore always equal.
 * - Inter-state: IGST is calculated at the full rate and rounded half up once.
 *
 * Because of rounding, CGST + SGST can differ from IGST on the same value by 1 paisa
 * (e.g. ₹0.03 at 18%: IGST ₹0.01, CGST ₹0.00 + SGST ₹0.00). This is expected.
 *
 * This function is pure arithmetic: it does not know which rate applies to an item.
 */
export function calculateGst(
  taxablePaise: Paise,
  rateBasisPoints: BasisPoints,
  supply: "intra-state" | "inter-state",
  field = "gst",
): GstComponents {
  const taxable = BigInt(asPaise(taxablePaise, field, "Taxable value"));
  if (
    !Number.isSafeInteger(rateBasisPoints) ||
    rateBasisPoints <= 0 ||
    rateBasisPoints > ONE_HUNDRED_PERCENT
  ) {
    throw new InvalidInputError(
      "out_of_range",
      "GST rate must be greater than 0% and at most 100%.",
      field,
    );
  }
  const rate = BigInt(rateBasisPoints);

  if (supply === "intra-state") {
    // Half the rate: amount × rate / (2 × 10,000).
    const half = Number(mulDivRoundHalfUp(taxable, rate, 2n * BigInt(ONE_HUNDRED_PERCENT)));
    return {
      cgstPaise: half as Paise,
      sgstPaise: half as Paise,
      igstPaise: 0 as Paise,
      totalTaxPaise: (half * 2) as Paise,
    };
  }

  const igst = Number(mulDivRoundHalfUp(taxable, rate, BigInt(ONE_HUNDRED_PERCENT)));
  return {
    cgstPaise: 0 as Paise,
    sgstPaise: 0 as Paise,
    igstPaise: igst as Paise,
    totalTaxPaise: igst as Paise,
  };
}
