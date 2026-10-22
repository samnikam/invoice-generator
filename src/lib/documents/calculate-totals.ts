import { InvalidInputError } from "@/lib/errors";
import { applyDiscount, type Discount } from "@/lib/money/discount";
import { asPaise, MAX_AMOUNT_PAISE, sumPaise, type Paise } from "@/lib/money/paise";
import type { BasisPoints } from "@/lib/money/percent";
import {
  asQuantityThousandths,
  QUANTITY_SCALE,
  type QuantityThousandths,
} from "@/lib/money/quantity";
import { mulDivRoundHalfUp } from "@/lib/money/rounding";
import { calculateGst } from "@/lib/tax/gst";
import { getGstRate, type GstRateId } from "@/lib/tax/gst-rates";
import { validateGstinFormat } from "@/lib/tax/gstin";
import { determineSupplyType, type PlaceOfSupply, type SupplyType } from "@/lib/tax/supply-type";

/**
 * DOCUMENT TOTALS ENGINE
 * ══════════════════════
 * Turns line items into every figure an invoice or quotation needs.
 * Order of operations for each line (see rounding.ts and discount.ts for the policies):
 *   1. line value      = quantity × unit price            (rounded half up to a paisa)
 *   2. discount        = percentage or fixed amount        (rounded half up)
 *   3. taxable value   = line value − discount             (discount is applied BEFORE GST)
 *   4. GST             = CGST + SGST/UTGST, or IGST         (each rounded half up)
 *   5. line total      = taxable value + GST
 * Document totals are sums of the rounded line figures. An optional round-off to the
 * nearest rupee is applied last and reported separately.
 */

/**
 * How GST applies to one line on a document that charges GST.
 * These are different legal categories and are deliberately NOT merged into "0%":
 * - taxable:        GST charged at a configured rate.
 * - nil-rated:      goods/services whose GST rate is 0% in the rate schedules.
 * - exempt:         supplies exempted from GST by notification.
 * - non-gst:        supplies outside GST law (e.g. certain petroleum products, alcohol
 *                   for human consumption).
 * - zero-rated-lut: exports or supplies to an SEZ made WITHOUT paying IGST, under a
 *                   Letter of Undertaking or bond. (Zero-rated supplies made WITH payment
 *                   of IGST use "taxable".)
 */
export type LineTaxTreatment =
  | { treatment: "taxable"; rateId: GstRateId }
  | { treatment: "nil-rated" }
  | { treatment: "exempt" }
  | { treatment: "non-gst" }
  | { treatment: "zero-rated-lut" };

export type NonTaxableTreatment = Exclude<LineTaxTreatment["treatment"], "taxable">;

export type LineItemInput = {
  quantity: QuantityThousandths;
  unitPricePaise: Paise;
  discount: Discount;
  /** Required when the document charges GST; must be omitted when it does not. */
  tax?: LineTaxTreatment;
};

/**
 * Whether the document charges GST.
 * - chargesGst: true  → a GST-registered seller charging tax (tax invoice). Seller state
 *   and place of supply are required; a seller GSTIN, if given, must match the state.
 * - chargesGst: false → no GST is charged at all (e.g. a bill of supply from a
 *   composition taxpayer, or an invoice from an unregistered seller). No line may carry
 *   a tax treatment. Which document title applies is decided by the caller, not here.
 */
export type TaxContext =
  | {
      chargesGst: true;
      sellerStateCode: string;
      sellerGstin?: string;
      placeOfSupply: PlaceOfSupply;
    }
  | { chargesGst: false };

export type CalculateTotalsInput = {
  lines: readonly LineItemInput[];
  taxContext: TaxContext;
  /** Round the grand total to the nearest rupee and report the difference as "round off". */
  roundOffToNearestRupee: boolean;
};

export type LineResult = {
  grossPaise: Paise;
  discountPaise: Paise;
  taxablePaise: Paise;
  treatment: LineTaxTreatment["treatment"] | null;
  rateId: GstRateId | null;
  rateBasisPoints: BasisPoints | null;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalPaise: Paise;
};

export type RateSummary = {
  rateId: GstRateId;
  rateBasisPoints: BasisPoints;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
};

export type DocumentTotals = {
  /** null when the document does not charge GST. */
  supplyType: SupplyType | null;
  lines: LineResult[];
  grossPaise: Paise;
  discountPaise: Paise;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalTaxPaise: Paise;
  totalBeforeRoundOffPaise: Paise;
  /** Signed: negative when rounded down, positive when rounded up, 0 when not applied. */
  roundOffPaise: number;
  grandTotalPaise: Paise;
  /** Taxable value and tax grouped by GST rate, lowest rate first. */
  rateSummary: RateSummary[];
  /** Value of lines that carry no GST, grouped by legal category. */
  nonTaxableValuePaise: Record<NonTaxableTreatment, Paise>;
};

function resolveSupplyType(context: TaxContext): SupplyType | null {
  if (!context.chargesGst) return null;

  const supplyType = determineSupplyType({
    sellerStateCode: context.sellerStateCode,
    placeOfSupply: context.placeOfSupply,
  });

  if (context.sellerGstin !== undefined && context.sellerGstin.trim() !== "") {
    const { state } = validateGstinFormat(context.sellerGstin, "sellerGstin");
    if (state.code !== context.sellerStateCode.trim()) {
      throw new InvalidInputError(
        "not_allowed",
        `Seller GSTIN belongs to state code ${state.code}, but the seller state is ${context.sellerStateCode.trim()}.`,
        "sellerGstin",
      );
    }
  }
  return supplyType;
}

function calculateLine(
  line: LineItemInput,
  index: number,
  context: TaxContext,
  supplyType: SupplyType | null,
): LineResult {
  const field = `lines[${index}]`;
  const quantity = asQuantityThousandths(line.quantity, `${field}.quantity`);
  const unitPrice = asPaise(line.unitPricePaise, `${field}.unitPrice`, "Unit price");

  const grossBig = mulDivRoundHalfUp(BigInt(unitPrice), BigInt(quantity), BigInt(QUANTITY_SCALE));
  if (grossBig > BigInt(MAX_AMOUNT_PAISE)) {
    throw new InvalidInputError(
      "too_large",
      "Line value (quantity × unit price) is larger than the maximum supported amount.",
      `${field}.quantity`,
    );
  }
  const grossPaise = Number(grossBig) as Paise;
  const { discountPaise, afterDiscountPaise: taxablePaise } = applyDiscount(
    grossPaise,
    line.discount,
    `${field}.discount`,
  );

  const noTax = { cgstPaise: 0 as Paise, sgstPaise: 0 as Paise, igstPaise: 0 as Paise };

  if (!context.chargesGst || !supplyType) {
    if (line.tax !== undefined) {
      throw new InvalidInputError(
        "not_allowed",
        "This document does not charge GST, so items cannot have a GST rate or tax treatment.",
        `${field}.tax`,
      );
    }
    return {
      grossPaise,
      discountPaise,
      taxablePaise,
      treatment: null,
      rateId: null,
      rateBasisPoints: null,
      ...noTax,
      totalPaise: taxablePaise,
    };
  }

  const tax = line.tax;
  if (!tax) {
    throw new InvalidInputError(
      "required",
      "Choose a GST rate or tax treatment for this item.",
      `${field}.tax`,
    );
  }

  if (tax.treatment === "taxable") {
    const rate = getGstRate(tax.rateId, `${field}.tax.rateId`);
    const gst = calculateGst(taxablePaise, rate.basisPoints, supplyType.kind, `${field}.tax`);
    return {
      grossPaise,
      discountPaise,
      taxablePaise,
      treatment: "taxable",
      rateId: rate.id as GstRateId,
      rateBasisPoints: rate.basisPoints,
      cgstPaise: gst.cgstPaise,
      sgstPaise: gst.sgstPaise,
      igstPaise: gst.igstPaise,
      totalPaise: sumPaise([taxablePaise, gst.totalTaxPaise], `${field}.total`, "Line total"),
    };
  }

  if (
    tax.treatment === "zero-rated-lut" &&
    !(supplyType.kind === "inter-state" && supplyType.reason !== "different-state")
  ) {
    throw new InvalidInputError(
      "not_allowed",
      "Zero-rated supply under LUT/bond is only allowed for exports or supplies to an SEZ.",
      `${field}.tax`,
    );
  }

  return {
    grossPaise,
    discountPaise,
    taxablePaise,
    treatment: tax.treatment,
    rateId: null,
    rateBasisPoints: null,
    ...noTax,
    totalPaise: taxablePaise,
  };
}

/** Calculates line-level and document-level figures. Throws InvalidInputError on bad input. */
export function calculateDocumentTotals(input: CalculateTotalsInput): DocumentTotals {
  if (input.lines.length === 0) {
    throw new InvalidInputError("required", "Add at least one item.", "lines");
  }

  const supplyType = resolveSupplyType(input.taxContext);
  const lines = input.lines.map((line, index) =>
    calculateLine(line, index, input.taxContext, supplyType),
  );

  const sum = (pick: (l: LineResult) => Paise, field: string, label: string) =>
    sumPaise(lines.map(pick), field, label);

  const grossPaise = sum((l) => l.grossPaise, "total", "Total value");
  const discountPaise = sum((l) => l.discountPaise, "total", "Total discount");
  const taxablePaise = sum((l) => l.taxablePaise, "total", "Total taxable value");
  const cgstPaise = sum((l) => l.cgstPaise, "total", "Total CGST");
  const sgstPaise = sum((l) => l.sgstPaise, "total", "Total SGST");
  const igstPaise = sum((l) => l.igstPaise, "total", "Total IGST");
  const totalTaxPaise = sumPaise([cgstPaise, sgstPaise, igstPaise], "total", "Total tax");
  const totalBeforeRoundOffPaise = sumPaise([taxablePaise, totalTaxPaise], "total", "Total");

  let grandTotalPaise = totalBeforeRoundOffPaise;
  if (input.roundOffToNearestRupee) {
    const rupees = mulDivRoundHalfUp(BigInt(totalBeforeRoundOffPaise), 1n, 100n);
    grandTotalPaise = asPaise(Number(rupees * 100n), "total", "Grand total");
  }
  const roundOffPaise = grandTotalPaise - totalBeforeRoundOffPaise;

  const rateSummary: RateSummary[] = [];
  for (const line of lines) {
    if (line.rateId === null || line.rateBasisPoints === null) continue;
    let entry = rateSummary.find((r) => r.rateId === line.rateId);
    if (!entry) {
      entry = {
        rateId: line.rateId,
        rateBasisPoints: line.rateBasisPoints,
        taxablePaise: 0 as Paise,
        cgstPaise: 0 as Paise,
        sgstPaise: 0 as Paise,
        igstPaise: 0 as Paise,
      };
      rateSummary.push(entry);
    }
    entry.taxablePaise = sumPaise([entry.taxablePaise, line.taxablePaise]);
    entry.cgstPaise = sumPaise([entry.cgstPaise, line.cgstPaise]);
    entry.sgstPaise = sumPaise([entry.sgstPaise, line.sgstPaise]);
    entry.igstPaise = sumPaise([entry.igstPaise, line.igstPaise]);
  }
  rateSummary.sort((a, b) => a.rateBasisPoints - b.rateBasisPoints);

  const nonTaxable = (treatment: NonTaxableTreatment) =>
    sumPaise(lines.filter((l) => l.treatment === treatment).map((l) => l.taxablePaise));

  return {
    supplyType,
    lines,
    grossPaise,
    discountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalTaxPaise,
    totalBeforeRoundOffPaise,
    roundOffPaise,
    grandTotalPaise,
    rateSummary,
    nonTaxableValuePaise: {
      "nil-rated": nonTaxable("nil-rated"),
      exempt: nonTaxable("exempt"),
      "non-gst": nonTaxable("non-gst"),
      "zero-rated-lut": nonTaxable("zero-rated-lut"),
    },
  };
}
