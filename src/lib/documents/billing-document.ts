import type { TreatmentChoice } from "@/lib/calculators/gst-calculator";
import { parsePlaceOfSupply, parseSellerState } from "@/lib/calculators/place-of-supply";
import { parseIsoDate } from "@/lib/dates";
import {
  calculateDocumentTotals,
  type DocumentTotals,
  type LineItemInput,
  type LineTaxTreatment,
  type TaxContext,
} from "@/lib/documents/calculate-totals";
import { InvalidInputError } from "@/lib/errors";
import { NO_DISCOUNT, type Discount } from "@/lib/money/discount";
import { calculateBalance, type PaymentBalance } from "@/lib/money/balance";
import { parseRupees, type Paise } from "@/lib/money/paise";
import { parsePercent } from "@/lib/money/percent";
import { parseQuantity } from "@/lib/money/quantity";
import { getGstRate, type GstRateId } from "@/lib/tax/gst-rates";
import { validateGstinFormat } from "@/lib/tax/gstin";
import type { PlaceOfSupply } from "@/lib/tax/supply-type";

/**
 * ITEMISED BILLING DOCUMENTS (INVOICES AND QUOTATIONS) → VALIDATED DOCUMENT
 * ════════════════════════════════════════════════════════════════════════
 * Pure functions that turn the raw form (all text, exactly as typed) into field-level
 * error messages and, when the items and tax details are valid, the document totals
 * from the shared engine (calculateDocumentTotals). No tax or money formula lives here.
 *
 * Invoices and quotations share the same items, parties and tax rules; the differences
 * (labels, which closing date applies, GSTIN rules, titles) live in DOCUMENT_KINDS.
 *
 * GST modes:
 * - "with-gst":    GST is calculated. Seller state and place of supply are required and
 *                  each item needs a GST treatment. On an INVOICE this is a tax invoice from
 *                  a GST-registered seller, so the seller GSTIN is required; on a QUOTATION
 *                  the GSTIN is optional (checked if entered).
 * - "without-gst": no GST. An invoice without GST is for sellers not registered for GST,
 *                  so a seller GSTIN is refused; a quotation without GST simply adds no GST.
 * A "bill of supply" (composition / exempt-only sellers) is not supported yet.
 */
export type BillingDocumentKind = "invoice" | "quotation";
export type GstMode = "with-gst" | "without-gst";
export type DiscountChoice = "none" | "percent" | "amount";

export type KindConfig = {
  /** Lower-case noun for sentences: "invoice", "quotation". */
  noun: string;
  /** Capitalised noun used in fallback labels. */
  Noun: string;
  numberLabel: string;
  numberExample: string;
  dateLabel: string;
  /** The optional closing date: an invoice's due date or a quotation's validity date. */
  endDate: { field: "dueDate" | "validUntil"; label: string; beforeMessage: string };
  /** Printed document title for each GST mode. */
  title: Record<GstMode, string>;
  typeLabel: string;
  typeRequiredMessage: string;
  gstModes: readonly { value: GstMode; title: string; hint: string }[];
  /** GSTIN rule when GST is calculated. */
  gstinWithGst: "required" | "optional";
  /** GSTIN rule when no GST is calculated: refuse it, or ignore it (field hidden). */
  gstinWithoutGst: "refuse" | "ignore";
};

export const DOCUMENT_KINDS: Record<BillingDocumentKind, KindConfig> = {
  invoice: {
    noun: "invoice",
    Noun: "Invoice",
    numberLabel: "Invoice number",
    numberExample: "INV-2026/001",
    dateLabel: "Invoice date",
    endDate: {
      field: "dueDate",
      label: "Due date",
      beforeMessage: "Due date cannot be before the invoice date.",
    },
    title: { "with-gst": "Tax Invoice", "without-gst": "Invoice" },
    typeLabel: "Invoice type",
    typeRequiredMessage: "Choose whether you are charging GST on this invoice.",
    gstModes: [
      {
        value: "with-gst",
        title: "Tax invoice",
        hint: "I am registered for GST and charging GST on this sale.",
      },
      {
        value: "without-gst",
        title: "Invoice without GST",
        hint: "I am not registered for GST, so I cannot charge GST.",
      },
    ],
    gstinWithGst: "required",
    gstinWithoutGst: "refuse",
  },
  quotation: {
    noun: "quotation",
    Noun: "Quotation",
    numberLabel: "Quotation number",
    numberExample: "QT-2026/001",
    dateLabel: "Issue date",
    endDate: {
      field: "validUntil",
      label: "Valid until",
      beforeMessage: "“Valid until” cannot be before the issue date.",
    },
    title: { "with-gst": "Quotation", "without-gst": "Quotation" },
    typeLabel: "Quotation type",
    typeRequiredMessage: "Choose whether this quotation includes GST.",
    gstModes: [
      {
        value: "with-gst",
        title: "Quotation with GST",
        hint: "Show GST on the quoted prices (for GST-registered businesses).",
      },
      {
        value: "without-gst",
        title: "Quotation without GST",
        hint: "No GST is added to the quoted prices.",
      },
    ],
    gstinWithGst: "optional",
    gstinWithoutGst: "ignore",
  },
};

export type PartyValues = {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
};

export type LineValues = {
  /** Stable id used for React keys and error messages, never shown to users. */
  id: string;
  description: string;
  hsnSac: string;
  quantity: string;
  unitPrice: string;
  discountKind: DiscountChoice;
  discountValue: string;
  treatment: TreatmentChoice | "";
  rateId: string;
};

export type BillingDocumentValues = {
  kind: BillingDocumentKind;
  gstMode: GstMode | "";
  seller: PartyValues & { stateCode: string };
  customer: PartyValues;
  documentNumber: string;
  issueDate: string;
  /** Invoices only. */
  dueDate: string;
  /** Quotations only. */
  validUntil: string;
  placeOfSupply: string;
  recipientIsSez: boolean;
  lines: LineValues[];
  notes: string;
  terms: string;
  roundOff: boolean;
  /** Invoices only. Optional amount already received against this invoice (rupees text). */
  amountReceived: string;
  /** Invoices only. Optional payment mode / payment details shown on the invoice. */
  paymentMode: string;
  /**
   * Invoices only. Optional logo copied from the business profile when the invoice is
   * started (a validated PNG/JPEG data URL), or "" for no logo.
   */
  sellerLogo: string;
};

export function createEmptyLine(id: string): LineValues {
  return {
    id,
    description: "",
    hsnSac: "",
    quantity: "1",
    unitPrice: "",
    discountKind: "none",
    discountValue: "",
    treatment: "",
    rateId: "",
  };
}

export function createEmptyDocument(kind: BillingDocumentKind): BillingDocumentValues {
  const party: PartyValues = { name: "", address: "", phone: "", email: "", gstin: "" };
  return {
    kind,
    gstMode: "",
    seller: { ...party, stateCode: "" },
    customer: { ...party },
    documentNumber: "",
    issueDate: "",
    dueDate: "",
    validUntil: "",
    placeOfSupply: "",
    recipientIsSez: false,
    lines: [createEmptyLine("line-1")],
    notes: "",
    terms: "",
    roundOff: false,
    amountReceived: "",
    paymentMode: "",
    sellerLogo: "",
  };
}

/** True when the seller GSTIN should be shown on the form and the document. */
export function showsSellerGstin(values: BillingDocumentValues): boolean {
  return values.gstMode === "with-gst" || DOCUMENT_KINDS[values.kind].gstinWithoutGst === "refuse";
}

/* ───────────── field keys and labels ───────────── */

/** Field keys: "seller.name", "documentNumber", "lines.<lineId>.quantity", … */
export type FieldKey = string;

export type DocumentIssue = { field: FieldKey; label: string; message: string };

export type DocumentEvaluation = {
  /** Every problem, in form order. Empty when the document is ready to print. */
  issues: DocumentIssue[];
  errors: Record<FieldKey, string>;
  /** Totals from the shared engine, or null while items or tax details are invalid. */
  totals: DocumentTotals | null;
  /** Parsed quantity and unit price per line (same order as the form), or null if invalid. */
  parsedLines: (Pick<LineItemInput, "quantity" | "unitPricePaise"> | null)[];
  /**
   * Invoices only: amount received and balance due, from the shared balance helper.
   * null when no amount received is entered (or totals/amount are not yet valid).
   */
  balance: PaymentBalance | null;
};

const lineField = (id: string, name: keyof LineValues) => `lines.${id}.${name}`;

/** HTML id for a field key, used to link error messages and the error summary to inputs. */
export function fieldDomId(field: FieldKey): string {
  return `doc-${field.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

/* ───────────── validation helpers (shared with receipts) ───────────── */

export const TEXT_LIMITS = { name: 100, address: 300, description: 300, notes: 1000 } as const;
const PHONE = /^\+?[\d\s-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Up to 16 characters: letters, digits, "-" and "/". */
const DOCUMENT_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const HSN_SAC = /^(\d{4}|\d{6}|\d{8})$/;

export function requireText(value: string, label: string, max: number): string | undefined {
  const text = value.trim();
  if (text === "") return `${label} is required.`;
  if (text.length > max) return `${label} must be ${max} characters or fewer.`;
  return undefined;
}

export function optionalText(value: string, label: string, max: number): string | undefined {
  return value.trim().length > max ? `${label} must be ${max} characters or fewer.` : undefined;
}

export function optionalPhone(value: string): string | undefined {
  const text = value.trim();
  return text && !PHONE.test(text)
    ? "Enter a valid phone number using digits, spaces, + and - only."
    : undefined;
}

export function optionalEmail(value: string): string | undefined {
  const text = value.trim();
  return text && !EMAIL.test(text)
    ? "Enter a valid email address, e.g. name@example.com."
    : undefined;
}

/** Document/receipt number: required, up to 16 letters, digits, "-" and "/". */
export function documentNumberError(
  value: string,
  label: string,
  example: string,
): string | undefined {
  const number = value.trim();
  if (number === "") return `${label} is required.`;
  return DOCUMENT_NUMBER.test(number)
    ? undefined
    : `Use up to 16 characters: letters, numbers, “-” and “/” only (e.g. ${example}).`;
}

export function messageOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    if (error instanceof InvalidInputError) return error.message;
    throw error;
  }
}

/* ───────────── evaluation ───────────── */

export function evaluateDocument(values: BillingDocumentValues): DocumentEvaluation {
  const config = DOCUMENT_KINDS[values.kind];
  const issues: DocumentIssue[] = [];
  const add = (field: FieldKey, label: string, message: string | undefined) => {
    if (message && !issues.some((i) => i.field === field)) issues.push({ field, label, message });
  };
  const withGst = values.gstMode === "with-gst";

  // GST mode
  if (values.gstMode === "") add("gstMode", config.typeLabel, config.typeRequiredMessage);

  // Seller
  const s = values.seller;
  add("seller.name", "Business name", requireText(s.name, "Business name", TEXT_LIMITS.name));
  add(
    "seller.address",
    "Business address",
    requireText(s.address, "Business address", TEXT_LIMITS.address),
  );
  add("seller.phone", "Business phone", optionalPhone(s.phone));
  add("seller.email", "Business email", optionalEmail(s.email));

  let sellerStateCode: string | undefined;
  if (withGst) {
    add(
      "seller.stateCode",
      "Business state",
      messageOf(() => (sellerStateCode = parseSellerState(s.stateCode))),
    );
    if (s.gstin.trim() === "") {
      if (config.gstinWithGst === "required") {
        add("seller.gstin", "Business GSTIN", `GSTIN is required on a tax ${config.noun}.`);
      }
    } else {
      const gstinError = messageOf(() => {
        const { state } = validateGstinFormat(s.gstin, "seller.gstin");
        if (sellerStateCode && state.code !== sellerStateCode) {
          throw new InvalidInputError(
            "not_allowed",
            `This GSTIN belongs to state code ${state.code}, but the business state is ${sellerStateCode}.`,
          );
        }
      });
      add("seller.gstin", "Business GSTIN", gstinError);
    }
  } else if (
    values.gstMode === "without-gst" &&
    config.gstinWithoutGst === "refuse" &&
    s.gstin.trim() !== ""
  ) {
    add(
      "seller.gstin",
      "Business GSTIN",
      `Remove the GSTIN, or choose “${config.gstModes[0]?.title}”. A GST-registered business should not use an ${config.noun} without GST.`,
    );
  }

  // Customer
  const c = values.customer;
  add("customer.name", "Customer name", requireText(c.name, "Customer name", TEXT_LIMITS.name));
  add(
    "customer.address",
    "Customer address",
    optionalText(c.address, "Customer address", TEXT_LIMITS.address),
  );
  add("customer.phone", "Customer phone", optionalPhone(c.phone));
  add("customer.email", "Customer email", optionalEmail(c.email));
  if (c.gstin.trim() !== "") {
    add(
      "customer.gstin",
      "Customer GSTIN",
      messageOf(() => validateGstinFormat(c.gstin)),
    );
  }

  // Document details
  add(
    "documentNumber",
    config.numberLabel,
    documentNumberError(values.documentNumber, config.numberLabel, config.numberExample),
  );
  const issueDateError = messageOf(() =>
    parseIsoDate(values.issueDate, "issueDate", config.dateLabel),
  );
  add("issueDate", config.dateLabel, issueDateError);

  const end = config.endDate;
  const endValue = values[end.field];
  if (endValue.trim() !== "") {
    const endError = messageOf(() => parseIsoDate(endValue, end.field, end.label));
    add(
      end.field,
      end.label,
      endError ?? (!issueDateError && endValue < values.issueDate ? end.beforeMessage : undefined),
    );
  }

  let placeOfSupply: PlaceOfSupply | undefined;
  if (withGst) {
    add(
      "placeOfSupply",
      "Place of supply",
      messageOf(
        () => (placeOfSupply = parsePlaceOfSupply(values.placeOfSupply, values.recipientIsSez)),
      ),
    );
  }

  // Line items
  if (values.lines.length === 0) add("lines", "Items", "Add at least one item.");
  const lineInputs: LineItemInput[] = [];
  const parsedLines: DocumentEvaluation["parsedLines"] = [];
  let linesValid = values.lines.length > 0;

  values.lines.forEach((line, index) => {
    const n = index + 1;
    const before = issues.length;
    add(
      lineField(line.id, "description"),
      `Item ${n}: description`,
      requireText(line.description, "Description", TEXT_LIMITS.description),
    );
    if (line.hsnSac.trim() !== "" && !HSN_SAC.test(line.hsnSac.trim())) {
      add(
        lineField(line.id, "hsnSac"),
        `Item ${n}: HSN/SAC`,
        "HSN/SAC code must be 4, 6 or 8 digits.",
      );
    }

    let quantity: LineItemInput["quantity"] | undefined;
    add(
      lineField(line.id, "quantity"),
      `Item ${n}: quantity`,
      messageOf(() => (quantity = parseQuantity(line.quantity, "quantity", "Quantity"))),
    );
    let unitPrice: LineItemInput["unitPricePaise"] | undefined;
    add(
      lineField(line.id, "unitPrice"),
      `Item ${n}: unit price`,
      messageOf(() => (unitPrice = parseRupees(line.unitPrice, "unitPrice", "Unit price"))),
    );

    let discount: Discount = NO_DISCOUNT;
    if (line.discountKind !== "none") {
      add(
        lineField(line.id, "discountValue"),
        `Item ${n}: discount`,
        messageOf(() => {
          discount =
            line.discountKind === "percent"
              ? {
                  kind: "percent",
                  basisPoints: parsePercent(line.discountValue, "discount", "Discount percentage"),
                }
              : {
                  kind: "amount",
                  paise: parseRupees(line.discountValue, "discount", "Discount amount"),
                };
        }),
      );
    }

    let tax: LineTaxTreatment | undefined;
    if (withGst) {
      if (line.treatment === "") {
        add(
          lineField(line.id, "treatment"),
          `Item ${n}: GST treatment`,
          "Choose how GST applies to this item.",
        );
      } else if (line.treatment === "taxable") {
        if (line.rateId === "") {
          add(lineField(line.id, "rateId"), `Item ${n}: GST rate`, "Select a GST rate.");
        } else {
          add(
            lineField(line.id, "rateId"),
            `Item ${n}: GST rate`,
            messageOf(() => {
              tax = { treatment: "taxable", rateId: getGstRate(line.rateId).id as GstRateId };
            }),
          );
        }
      } else {
        tax = { treatment: line.treatment };
      }
    }

    if (issues.length > before || quantity === undefined || unitPrice === undefined) {
      linesValid = false;
      return;
    }
    parsedLines[index] = { quantity, unitPricePaise: unitPrice };
    lineInputs.push({ quantity, unitPricePaise: unitPrice, discount, tax });
  });

  // Totals from the shared engine — only when items and tax details are valid.
  let totals: DocumentTotals | null = null;
  const taxContextValid =
    values.gstMode === "without-gst" ||
    (withGst && sellerStateCode !== undefined && placeOfSupply !== undefined);

  if (linesValid && taxContextValid) {
    const taxContext: TaxContext = withGst
      ? {
          chargesGst: true,
          sellerStateCode: sellerStateCode as string,
          placeOfSupply: placeOfSupply as PlaceOfSupply,
        }
      : { chargesGst: false };
    try {
      totals = calculateDocumentTotals({
        lines: lineInputs,
        taxContext,
        roundOffToNearestRupee: values.roundOff,
      });
    } catch (error) {
      if (!(error instanceof InvalidInputError)) throw error;
      add(...mapEngineError(error, values));
    }
  }

  add("notes", "Notes", optionalText(values.notes, "Notes", TEXT_LIMITS.notes));
  add("terms", "Terms", optionalText(values.terms, "Terms", TEXT_LIMITS.notes));

  // Invoices only: payment mode and the optional amount received / balance due.
  let balance: PaymentBalance | null = null;
  if (values.kind === "invoice") {
    add(
      "paymentMode",
      "Payment mode",
      optionalText(values.paymentMode, "Payment mode", TEXT_LIMITS.address),
    );
    if (values.amountReceived.trim() !== "") {
      let received: Paise | null = null;
      let receivedError: string | undefined;
      try {
        received = parseRupees(values.amountReceived, "amountReceived", "Amount received");
      } catch (error) {
        if (!(error instanceof InvalidInputError)) throw error;
        receivedError = error.message;
      }
      if (received === 0) {
        receivedError =
          "Amount received must be more than ₹0. Leave it empty if nothing has been received.";
      }
      add("amountReceived", "Amount received", receivedError);
      if (!receivedError && received !== null && totals) {
        // Shared helper: an overpayment is reported as "overpaid" with the excess.
        balance = calculateBalance(totals.grandTotalPaise, 0 as Paise, received);
      }
    }
  }

  const errors: Record<FieldKey, string> = {};
  for (const issue of issues) errors[issue.field] = issue.message;
  const allParsedLines = values.lines.map((_, index) => parsedLines[index] ?? null);
  return { issues, errors, totals, parsedLines: allParsedLines, balance };
}

/** Points an engine error (e.g. "lines[2].discount") at the matching form field. */
function mapEngineError(
  error: InvalidInputError,
  values: BillingDocumentValues,
): [FieldKey, string, string] {
  const match = /^lines\[(\d+)\]\.?(\w+)?/.exec(error.field ?? "");
  if (match) {
    const index = Number(match[1]);
    const line = values.lines[index];
    const part = match[2] ?? "";
    const name: keyof LineValues =
      part === "discount"
        ? "discountValue"
        : part === "tax"
          ? "treatment"
          : part === "unitPrice"
            ? "unitPrice"
            : "quantity";
    if (line) return [lineField(line.id, name), `Item ${index + 1}`, error.message];
  }
  if (error.field?.startsWith("placeOfSupply")) {
    return ["placeOfSupply", "Place of supply", error.message];
  }
  return ["form", DOCUMENT_KINDS[values.kind].Noun, error.message];
}
