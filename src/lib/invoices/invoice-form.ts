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
import { parseRupees } from "@/lib/money/paise";
import { parsePercent } from "@/lib/money/percent";
import { parseQuantity } from "@/lib/money/quantity";
import { getGstRate, type GstRateId } from "@/lib/tax/gst-rates";
import { validateGstinFormat } from "@/lib/tax/gstin";
import type { PlaceOfSupply } from "@/lib/tax/supply-type";

/**
 * INVOICE FORM → VALIDATED INVOICE
 * ════════════════════════════════
 * Pure functions that turn the raw invoice form (all text, exactly as typed) into
 * field-level error messages and, when the items and tax details are valid, the
 * document totals from the shared engine (calculateDocumentTotals).
 * No tax or money formula lives here.
 *
 * Document types supported:
 * - "tax-invoice":     a GST-registered seller charging GST. Seller GSTIN, seller state
 *                      and place of supply are required; each item needs a GST treatment.
 * - "non-gst-invoice": a seller NOT registered for GST. No GSTIN and no GST.
 * A "bill of supply" (composition / exempt-only sellers) is not supported yet.
 */
export type InvoiceDocumentType = "tax-invoice" | "non-gst-invoice";
export type DiscountChoice = "none" | "percent" | "amount";

export type PartyValues = {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
};

export type InvoiceLineValues = {
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

export type InvoiceFormValues = {
  documentType: InvoiceDocumentType | "";
  seller: PartyValues & { stateCode: string };
  customer: PartyValues;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupply: string;
  recipientIsSez: boolean;
  lines: InvoiceLineValues[];
  notes: string;
  terms: string;
  roundOff: boolean;
};

export function createEmptyLine(id: string): InvoiceLineValues {
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

export function createEmptyInvoice(): InvoiceFormValues {
  const party: PartyValues = { name: "", address: "", phone: "", email: "", gstin: "" };
  return {
    documentType: "",
    seller: { ...party, stateCode: "" },
    customer: { ...party },
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    placeOfSupply: "",
    recipientIsSez: false,
    lines: [createEmptyLine("line-1")],
    notes: "",
    terms: "",
    roundOff: false,
  };
}

/* ───────────── field keys and labels ───────────── */

/** Field keys: "seller.name", "invoiceNumber", "lines.<lineId>.quantity", … */
export type InvoiceFieldKey = string;

export type InvoiceIssue = { field: InvoiceFieldKey; label: string; message: string };

export type InvoiceEvaluation = {
  /** Every problem, in form order. Empty when the invoice is ready to print. */
  issues: InvoiceIssue[];
  errors: Record<InvoiceFieldKey, string>;
  /** Totals from the shared engine, or null while items or tax details are invalid. */
  totals: DocumentTotals | null;
  /** Parsed quantity and unit price per line (same order as the form), or null if invalid. */
  parsedLines: (Pick<LineItemInput, "quantity" | "unitPricePaise"> | null)[];
};

const lineField = (id: string, name: keyof InvoiceLineValues) => `lines.${id}.${name}`;

/** HTML id for a field key, used to link error messages and the error summary to inputs. */
export function fieldDomId(field: InvoiceFieldKey): string {
  return `invoice-${field.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

/* ───────────── validation helpers ───────────── */

const MAX = { name: 100, address: 300, description: 300, notes: 1000 } as const;
const PHONE = /^\+?[\d\s-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Up to 16 characters: letters, digits, "-" and "/". */
const INVOICE_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const HSN_SAC = /^(\d{4}|\d{6}|\d{8})$/;

function requireText(value: string, label: string, max: number): string | undefined {
  const text = value.trim();
  if (text === "") return `${label} is required.`;
  if (text.length > max) return `${label} must be ${max} characters or fewer.`;
  return undefined;
}

function optionalText(value: string, label: string, max: number): string | undefined {
  return value.trim().length > max ? `${label} must be ${max} characters or fewer.` : undefined;
}

function optionalPhone(value: string): string | undefined {
  const text = value.trim();
  return text && !PHONE.test(text)
    ? "Enter a valid phone number using digits, spaces, + and - only."
    : undefined;
}

function optionalEmail(value: string): string | undefined {
  const text = value.trim();
  return text && !EMAIL.test(text)
    ? "Enter a valid email address, e.g. name@example.com."
    : undefined;
}

function messageOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    if (error instanceof InvalidInputError) return error.message;
    throw error;
  }
}

/* ───────────── evaluation ───────────── */

export function evaluateInvoice(values: InvoiceFormValues): InvoiceEvaluation {
  const issues: InvoiceIssue[] = [];
  const add = (field: InvoiceFieldKey, label: string, message: string | undefined) => {
    if (message && !issues.some((i) => i.field === field)) issues.push({ field, label, message });
  };
  const isTaxInvoice = values.documentType === "tax-invoice";

  // Document type
  if (values.documentType === "") {
    add("documentType", "Invoice type", "Choose whether you are charging GST on this invoice.");
  }

  // Seller
  const s = values.seller;
  add("seller.name", "Business name", requireText(s.name, "Business name", MAX.name));
  add(
    "seller.address",
    "Business address",
    requireText(s.address, "Business address", MAX.address),
  );
  add("seller.phone", "Business phone", optionalPhone(s.phone));
  add("seller.email", "Business email", optionalEmail(s.email));

  let sellerStateCode: string | undefined;
  if (isTaxInvoice) {
    add(
      "seller.stateCode",
      "Business state",
      messageOf(() => (sellerStateCode = parseSellerState(s.stateCode))),
    );
    if (s.gstin.trim() === "") {
      add("seller.gstin", "Business GSTIN", "GSTIN is required on a tax invoice.");
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
  } else if (values.documentType === "non-gst-invoice" && s.gstin.trim() !== "") {
    add(
      "seller.gstin",
      "Business GSTIN",
      "Remove the GSTIN, or choose “Tax invoice”. A GST-registered business should not use an invoice without GST.",
    );
  }

  // Customer
  const c = values.customer;
  add("customer.name", "Customer name", requireText(c.name, "Customer name", MAX.name));
  add(
    "customer.address",
    "Customer address",
    optionalText(c.address, "Customer address", MAX.address),
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

  // Invoice details
  const number = values.invoiceNumber.trim();
  add(
    "invoiceNumber",
    "Invoice number",
    number === ""
      ? "Invoice number is required."
      : INVOICE_NUMBER.test(number)
        ? undefined
        : "Use up to 16 characters: letters, numbers, “-” and “/” only (e.g. INV-2026/001).",
  );
  const invoiceDateError = messageOf(() =>
    parseIsoDate(values.invoiceDate, "invoiceDate", "Invoice date"),
  );
  add("invoiceDate", "Invoice date", invoiceDateError);
  if (values.dueDate.trim() !== "") {
    const dueError = messageOf(() => parseIsoDate(values.dueDate, "dueDate", "Due date"));
    add(
      "dueDate",
      "Due date",
      dueError ??
        (!invoiceDateError && values.dueDate < values.invoiceDate
          ? "Due date cannot be before the invoice date."
          : undefined),
    );
  }

  let placeOfSupply: PlaceOfSupply | undefined;
  if (isTaxInvoice) {
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
  const parsedLines: InvoiceEvaluation["parsedLines"] = [];
  let linesValid = values.lines.length > 0;

  values.lines.forEach((line, index) => {
    const n = index + 1;
    const before = issues.length;
    add(
      lineField(line.id, "description"),
      `Item ${n}: description`,
      requireText(line.description, "Description", MAX.description),
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
    if (isTaxInvoice) {
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
    values.documentType === "non-gst-invoice" ||
    (isTaxInvoice && sellerStateCode !== undefined && placeOfSupply !== undefined);

  if (linesValid && taxContextValid) {
    const taxContext: TaxContext = isTaxInvoice
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

  add("notes", "Notes", optionalText(values.notes, "Notes", MAX.notes));
  add("terms", "Terms", optionalText(values.terms, "Terms", MAX.notes));

  const errors: Record<InvoiceFieldKey, string> = {};
  for (const issue of issues) errors[issue.field] = issue.message;
  const allParsedLines = values.lines.map((_, index) => parsedLines[index] ?? null);
  return { issues, errors, totals, parsedLines: allParsedLines };
}

/** Points an engine error (e.g. "lines[2].discount") at the matching form field. */
function mapEngineError(
  error: InvalidInputError,
  values: InvoiceFormValues,
): [InvoiceFieldKey, string, string] {
  const match = /^lines\[(\d+)\]\.?(\w+)?/.exec(error.field ?? "");
  if (match) {
    const index = Number(match[1]);
    const line = values.lines[index];
    const part = match[2] ?? "";
    const name: keyof InvoiceLineValues =
      part === "discount"
        ? "discountValue"
        : part === "tax"
          ? "treatment"
          : part === "unitPrice"
            ? "unitPrice"
            : "quantity";
    if (line) return [lineField(line.id, name), `Item ${index + 1}`, error.message];
  }
  if (error.field?.startsWith("placeOfSupply"))
    return ["placeOfSupply", "Place of supply", error.message];
  return ["form", "Invoice", error.message];
}
