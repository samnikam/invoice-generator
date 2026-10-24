import {
  evaluateDocument,
  type BillingDocumentKind,
  type BillingDocumentValues,
  type DocumentEvaluation,
} from "@/lib/documents/billing-document";
import {
  evaluateReceipt,
  type ReceiptEvaluation,
  type ReceiptValues,
} from "@/lib/receipts/receipt";

/**
 * DOCUMENT HISTORY — records and searching
 * ════════════════════════════════════════
 * A history record is a SNAPSHOT of a finished document, saved only when the user
 * presses "Save to history". It holds:
 * - the document's form values at that moment (validated by the same parsers as drafts),
 * - a summary (number, customer, mobile, date, total) fixed at save time.
 *
 * Later edits to a form never touch a saved record. When a record is opened, it is
 * re-calculated from its values with the current rules and compared with the summary;
 * if anything differs (e.g. the GST rate list changed), the record is flagged instead of
 * silently showing different figures.
 *
 * Saving to history does NOT mean the document was sent to anyone.
 */

export type HistoryKind = "invoice" | "quotation" | "receipt";

export const HISTORY_KINDS: readonly HistoryKind[] = ["invoice", "quotation", "receipt"];

export const HISTORY_KIND_LABELS: Record<HistoryKind, string> = {
  invoice: "Invoice",
  quotation: "Quotation",
  receipt: "Receipt",
};

export type HistorySummary = {
  documentNumber: string;
  customerName: string;
  /** Customer / payer phone as entered (may be empty). */
  customerPhone: string;
  /** Document date as YYYY-MM-DD: issue date, or payment date for receipts. */
  date: string;
  /** Grand total (invoice/quotation) or amount received (receipt), in paise. */
  totalPaise: number;
};

/** A finished document of one of the three kinds, with its values. */
export type HistoryDocument =
  | { kind: BillingDocumentKind; values: BillingDocumentValues }
  | { kind: "receipt"; values: ReceiptValues };

export type HistoryRecord = HistoryDocument & {
  id: string;
  /** When the record was saved (ISO timestamp). */
  savedAt: string;
  summary: HistorySummary;
};

export type EvaluatedDocument =
  | { kind: BillingDocumentKind; values: BillingDocumentValues; evaluation: DocumentEvaluation }
  | { kind: "receipt"; values: ReceiptValues; evaluation: ReceiptEvaluation };

export function evaluateHistoryDocument(doc: HistoryDocument): EvaluatedDocument {
  return doc.kind === "receipt"
    ? { kind: "receipt", values: doc.values, evaluation: evaluateReceipt(doc.values) }
    : { kind: doc.kind, values: doc.values, evaluation: evaluateDocument(doc.values) };
}

/**
 * The summary of a finished document, or null if the document is not complete
 * (the same condition that blocks printing).
 */
export function summarize(doc: HistoryDocument): HistorySummary | null {
  const evaluated = evaluateHistoryDocument(doc);
  if (evaluated.kind === "receipt") {
    const { values, evaluation } = evaluated;
    if (evaluation.issues.length > 0 || evaluation.amountPaise === null) return null;
    return {
      documentNumber: values.receiptNumber.trim(),
      customerName: values.payer.name.trim(),
      customerPhone: values.payer.phone.trim(),
      date: values.paymentDate,
      totalPaise: evaluation.amountPaise,
    };
  }
  const { values, evaluation } = evaluated;
  if (evaluation.issues.length > 0 || evaluation.totals === null) return null;
  return {
    documentNumber: values.documentNumber.trim(),
    customerName: values.customer.name.trim(),
    customerPhone: values.customer.phone.trim(),
    date: values.issueDate,
    totalPaise: evaluation.totals.grandTotalPaise,
  };
}

export type RecordCheck =
  | { ok: true; evaluated: EvaluatedDocument }
  /** The record no longer produces the figures it was saved with. Do not reprint it. */
  | { ok: false; reason: "changed" | "incomplete" };

/** Re-calculates a saved record and confirms it still matches its saved summary. */
export function checkRecord(record: HistoryRecord): RecordCheck {
  const now = summarize(record);
  if (now === null) return { ok: false, reason: "incomplete" };
  const saved = record.summary;
  const same =
    now.documentNumber === saved.documentNumber &&
    now.customerName === saved.customerName &&
    now.customerPhone === saved.customerPhone &&
    now.date === saved.date &&
    now.totalPaise === saved.totalPaise;
  return same
    ? { ok: true, evaluated: evaluateHistoryDocument(record) }
    : { ok: false, reason: "changed" };
}

/* ───────────── searching and filtering ───────────── */

export type HistoryFilter = HistoryKind | "all";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * True when the record matches the search text: part of the customer name (ignoring
 * case and extra spaces), or — when the search contains at least 3 digits — part of the
 * customer's mobile number (ignoring spaces, dashes and a +91 prefix).
 */
export function matchesSearch(summary: HistorySummary, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (q === "") return true;
  if (summary.customerName.toLowerCase().replace(/\s+/g, " ").includes(q)) return true;
  const qDigits = digitsOnly(q);
  if (qDigits.length < 3) return false;
  const phone = digitsOnly(summary.customerPhone);
  if (phone === "") return false;
  const local = phone.length > 10 && phone.startsWith("91") ? phone.slice(2) : phone;
  const queryLocal = qDigits.length > 10 && qDigits.startsWith("91") ? qDigits.slice(2) : qDigits;
  return phone.includes(qDigits) || local.includes(queryLocal);
}

/** Records of the chosen type that match the search, newest saved first. */
export function filterRecords(
  records: readonly HistoryRecord[],
  filter: HistoryFilter,
  query: string,
): HistoryRecord[] {
  return records
    .filter((r) => (filter === "all" || r.kind === filter) && matchesSearch(r.summary, query))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Saved records of the same type and number (compared ignoring case and spaces). */
export function findSameNumber(
  records: readonly HistoryRecord[],
  kind: HistoryKind,
  documentNumber: string,
): HistoryRecord[] {
  const key = documentNumber.trim().toLowerCase();
  return records.filter(
    (r) => r.kind === kind && r.summary.documentNumber.trim().toLowerCase() === key,
  );
}
