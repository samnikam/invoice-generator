import {
  collectFieldError,
  hasErrors,
  type CalculatorOutcome,
  type FieldErrors,
} from "@/lib/calculators/outcome";
import { parsePlaceOfSupply, parseSellerState } from "@/lib/calculators/place-of-supply";
import { calculateDocumentTotals, type LineTaxTreatment } from "@/lib/documents/calculate-totals";
import { InvalidInputError } from "@/lib/errors";
import { NO_DISCOUNT } from "@/lib/money/discount";
import { parseRupees, type Paise } from "@/lib/money/paise";
import { QUANTITY_SCALE, type QuantityThousandths } from "@/lib/money/quantity";
import { getGstRate, type GstRate, type GstRateId } from "@/lib/tax/gst-rates";
import type { PlaceOfSupply, SupplyType } from "@/lib/tax/supply-type";

/**
 * GST CALCULATOR
 * Calculates GST on an amount BEFORE tax for one supply. It runs the same engine as
 * invoices (calculateDocumentTotals with a single item, quantity 1, no discount), so
 * rounding, state rules and treatment rules are identical.
 */
export type TreatmentChoice = LineTaxTreatment["treatment"];

export const TREATMENT_OPTIONS: readonly { value: TreatmentChoice; label: string; hint: string }[] =
  [
    { value: "taxable", label: "Taxable supply", hint: "GST is charged at the selected rate." },
    {
      value: "nil-rated",
      label: "Nil-rated",
      hint: "The item's GST rate is 0% in the rate schedules.",
    },
    { value: "exempt", label: "Exempt", hint: "The supply is exempted from GST by notification." },
    {
      value: "non-gst",
      label: "Non-GST supply",
      hint: "The supply is outside GST law (e.g. certain petroleum products).",
    },
    {
      value: "zero-rated-lut",
      label: "Zero-rated under LUT/bond",
      hint: "Export or SEZ supply made without paying IGST.",
    },
  ];

export type GstCalculatorField =
  "amount" | "treatment" | "rateId" | "sellerState" | "placeOfSupply" | "form";

export type GstCalculatorInput = {
  amount: string;
  /** Empty until the user chooses — the treatment is never assumed. */
  treatment: TreatmentChoice | "";
  rateId: string;
  sellerState: string;
  placeOfSupply: string;
  recipientIsSez: boolean;
};

export type GstCalculatorResult = {
  amountPaise: Paise;
  treatment: TreatmentChoice;
  rate: GstRate | null;
  supplyType: SupplyType;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalTaxPaise: Paise;
  totalWithGstPaise: Paise;
};

export function runGstCalculator(
  input: GstCalculatorInput,
): CalculatorOutcome<GstCalculatorField, GstCalculatorResult> {
  const errors: FieldErrors<GstCalculatorField> = {};

  const amountPaise = collectFieldError(errors, "amount", () =>
    parseRupees(input.amount, "amount", "Amount before GST"),
  );

  let rate: GstRate | null = null;
  if (input.treatment === "") {
    errors.treatment = "Choose how GST applies to this supply.";
  } else if (input.treatment === "taxable") {
    if (input.rateId === "") {
      errors.rateId = "Select a GST rate.";
    } else {
      rate = collectFieldError(errors, "rateId", () => getGstRate(input.rateId, "rateId")) ?? null;
    }
  }

  const sellerStateCode = collectFieldError(errors, "sellerState", () =>
    parseSellerState(input.sellerState),
  );
  const placeOfSupply = collectFieldError(errors, "placeOfSupply", () =>
    parsePlaceOfSupply(input.placeOfSupply, input.recipientIsSez),
  );

  if (
    hasErrors(errors) ||
    amountPaise === undefined ||
    input.treatment === "" ||
    sellerStateCode === undefined ||
    placeOfSupply === undefined
  ) {
    return { ok: false, errors };
  }

  const tax: LineTaxTreatment =
    input.treatment === "taxable"
      ? { treatment: "taxable", rateId: (rate as GstRate).id as GstRateId }
      : { treatment: input.treatment };

  try {
    const totals = calculateDocumentTotals({
      lines: [
        {
          quantity: QUANTITY_SCALE as QuantityThousandths,
          unitPricePaise: amountPaise,
          discount: NO_DISCOUNT,
          tax,
        },
      ],
      taxContext: {
        chargesGst: true,
        sellerStateCode,
        placeOfSupply: placeOfSupply as PlaceOfSupply,
      },
      roundOffToNearestRupee: false,
    });
    return {
      ok: true,
      result: {
        amountPaise,
        treatment: input.treatment,
        rate,
        supplyType: totals.supplyType as SupplyType,
        cgstPaise: totals.cgstPaise,
        sgstPaise: totals.sgstPaise,
        igstPaise: totals.igstPaise,
        totalTaxPaise: totals.totalTaxPaise,
        totalWithGstPaise: totals.grandTotalPaise,
      },
    };
  } catch (error) {
    if (error instanceof InvalidInputError) {
      // Rules that involve more than one field (e.g. LUT only for exports/SEZ).
      const field: GstCalculatorField = error.field?.endsWith(".tax") ? "treatment" : "form";
      return { ok: false, errors: { [field]: error.message } };
    }
    throw error;
  }
}
