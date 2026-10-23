import { parseIsoDate } from "@/lib/dates";
import {
  documentNumberError,
  messageOf,
  optionalEmail,
  optionalPhone,
  optionalText,
  requireText,
  TEXT_LIMITS,
  type DocumentIssue,
} from "@/lib/documents/billing-document";
import { calculateBalance, type PaymentBalance } from "@/lib/money/balance";
import { parseRupees, type Paise } from "@/lib/money/paise";

/**
 * PAYMENT RECEIPT
 * ═══════════════
 * A receipt acknowledges money actually received. It is NOT a tax invoice and says so.
 *
 * Optional balance: if the user enters the total of the invoice being paid (and anything
 * paid earlier), the receipt also shows what remains. Amounts are whole paise; the totals
 * use sumPaise (which enforces the supported maximum) and plain integer subtraction,
 * which is exact for whole numbers in this range. Nothing is rounded.
 */
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", referenceLabel: "Reference" },
  { value: "upi", label: "UPI", referenceLabel: "UPI transaction ID" },
  {
    value: "bank-transfer",
    label: "Bank transfer (NEFT / RTGS / IMPS)",
    referenceLabel: "Transaction reference (UTR)",
  },
  { value: "cheque", label: "Cheque", referenceLabel: "Cheque number" },
  { value: "card", label: "Card", referenceLabel: "Transaction reference" },
  { value: "other", label: "Other", referenceLabel: "Reference" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function paymentMethodInfo(method: PaymentMethod | "") {
  return PAYMENT_METHODS.find((m) => m.value === method);
}

export type ContactValues = { name: string; address: string; phone: string; email: string };

export type ReceiptValues = {
  business: ContactValues;
  receiptNumber: string;
  paymentDate: string;
  payer: ContactValues;
  amount: string;
  method: PaymentMethod | "";
  reference: string;
  /** Optional invoice or quotation number this payment relates to. */
  againstDocument: string;
  note: string;
  /** Optional: total of the invoice being paid, to show the remaining balance. */
  documentTotal: string;
  /** Optional: amount paid before this receipt. */
  previouslyPaid: string;
};

export function createEmptyReceipt(): ReceiptValues {
  const contact: ContactValues = { name: "", address: "", phone: "", email: "" };
  return {
    business: { ...contact },
    receiptNumber: "",
    paymentDate: "",
    payer: { ...contact },
    amount: "",
    method: "",
    reference: "",
    againstDocument: "",
    note: "",
    documentTotal: "",
    previouslyPaid: "",
  };
}

/** Kept under its original names so receipt code and tests are unchanged. */
export { calculateBalance };
export type ReceiptBalance = PaymentBalance;

export type ReceiptEvaluation = {
  issues: DocumentIssue[];
  errors: Record<string, string>;
  /** Amount received in paise, or null while it is missing or invalid. */
  amountPaise: Paise | null;
  /** null when no invoice total was entered (or the balance inputs are invalid). */
  balance: ReceiptBalance | null;
};

const LIMITS = { reference: 50, againstDocument: 30 } as const;

export function evaluateReceipt(values: ReceiptValues): ReceiptEvaluation {
  const issues: DocumentIssue[] = [];
  const add = (field: string, label: string, message: string | undefined) => {
    if (message && !issues.some((i) => i.field === field)) issues.push({ field, label, message });
  };

  // Business
  const b = values.business;
  add("business.name", "Business name", requireText(b.name, "Business name", TEXT_LIMITS.name));
  add(
    "business.address",
    "Business address",
    optionalText(b.address, "Business address", TEXT_LIMITS.address),
  );
  add("business.phone", "Business phone", optionalPhone(b.phone));
  add("business.email", "Business email", optionalEmail(b.email));

  // Receipt details
  add(
    "receiptNumber",
    "Receipt number",
    documentNumberError(values.receiptNumber, "Receipt number", "RCPT-2026/001"),
  );
  add(
    "paymentDate",
    "Payment date",
    messageOf(() => parseIsoDate(values.paymentDate, "paymentDate", "Payment date")),
  );

  // Payer
  const p = values.payer;
  add("payer.name", "Received from", requireText(p.name, "Payer name", TEXT_LIMITS.name));
  add(
    "payer.address",
    "Payer address",
    optionalText(p.address, "Payer address", TEXT_LIMITS.address),
  );
  add("payer.phone", "Payer phone", optionalPhone(p.phone));
  add("payer.email", "Payer email", optionalEmail(p.email));

  // Payment
  let amountPaise: Paise | null = null;
  const amountError = messageOf(() => {
    amountPaise = parseRupees(values.amount, "amount", "Amount received");
  });
  add(
    "amount",
    "Amount received",
    amountError ?? (amountPaise === 0 ? "Amount received must be more than ₹0." : undefined),
  );
  if (amountPaise === 0) amountPaise = null;

  if (values.method === "") {
    add("method", "Payment method", "Choose how the payment was made.");
  }
  add("reference", "Reference", optionalText(values.reference, "Reference", LIMITS.reference));
  add(
    "againstDocument",
    "Invoice / quotation number",
    optionalText(values.againstDocument, "Invoice or quotation number", LIMITS.againstDocument),
  );
  add("note", "Note", optionalText(values.note, "Note", TEXT_LIMITS.notes));

  // Optional balance
  let balance: ReceiptBalance | null = null;
  const hasTotal = values.documentTotal.trim() !== "";
  const hasPrevious = values.previouslyPaid.trim() !== "";
  if (hasTotal || hasPrevious) {
    let total: Paise | undefined;
    if (!hasTotal) {
      add(
        "documentTotal",
        "Invoice total",
        "Enter the invoice total to calculate the balance, or clear “Previously paid”.",
      );
    } else {
      const totalError = messageOf(() => {
        total = parseRupees(values.documentTotal, "documentTotal", "Invoice total");
      });
      add(
        "documentTotal",
        "Invoice total",
        totalError ?? (total === 0 ? "Invoice total must be more than ₹0." : undefined),
      );
    }
    let previous = 0 as Paise;
    if (hasPrevious) {
      add(
        "previouslyPaid",
        "Previously paid",
        messageOf(() => {
          previous = parseRupees(values.previouslyPaid, "previouslyPaid", "Previously paid");
        }),
      );
    }
    const balanceInputsValid =
      total !== undefined && total > 0 && !issues.some((i) => i.field === "previouslyPaid");
    if (balanceInputsValid && amountPaise !== null) {
      add(
        "previouslyPaid",
        "Previously paid",
        messageOf(() => {
          balance = calculateBalance(total as Paise, previous, amountPaise as Paise);
        }),
      );
    }
  }

  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.field] = issue.message;
  return { issues, errors, amountPaise, balance };
}
