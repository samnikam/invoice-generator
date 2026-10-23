import { TREATMENT_OPTIONS } from "@/lib/calculators/gst-calculator";
import {
  type BillingDocumentKind,
  type BillingDocumentValues,
  type LineValues,
  type PartyValues,
} from "@/lib/documents/billing-document";
import { PAYMENT_METHODS, type ContactValues, type ReceiptValues } from "@/lib/receipts/receipt";

/**
 * Checks data read back from browser storage before it is put into a form.
 *
 * Stored data may be corrupt, edited by hand, or written by another version, so nothing
 * is trusted: each draft is rebuilt field by field from the expected types, unknown
 * fields are dropped, and anything unexpected rejects the whole draft (returns null).
 * Text values are restored exactly as stored — they are re-validated by the form like
 * anything the user types, and no amount is changed.
 */

/** Generous limits that real drafts never reach; they stop oversized junk data. */
const MAX_TEXT = 5000;
const MAX_LINES = 200;

class ShapeError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ShapeError();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_TEXT) throw new ShapeError();
  return value;
}

function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new ShapeError();
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new ShapeError();
  return value as T;
}

function party(value: unknown): PartyValues {
  const p = record(value);
  return {
    name: text(p.name),
    address: text(p.address),
    phone: text(p.phone),
    email: text(p.email),
    gstin: text(p.gstin),
  };
}

function contact(value: unknown): ContactValues {
  const c = record(value);
  return {
    name: text(c.name),
    address: text(c.address),
    phone: text(c.phone),
    email: text(c.email),
  };
}

const TREATMENTS = ["", ...TREATMENT_OPTIONS.map((o) => o.value)] as const;

function line(value: unknown): LineValues {
  const l = record(value);
  const id = text(l.id);
  if (!/^line-\d{1,6}$/.test(id)) throw new ShapeError();
  return {
    id,
    description: text(l.description),
    hsnSac: text(l.hsnSac),
    quantity: text(l.quantity),
    unitPrice: text(l.unitPrice),
    discountKind: oneOf(l.discountKind, ["none", "percent", "amount"] as const),
    discountValue: text(l.discountValue),
    treatment: oneOf(l.treatment, TREATMENTS),
    rateId: text(l.rateId),
  };
}

/** Returns a valid invoice/quotation draft of the expected kind, or null. */
export function parseBillingDocumentDraft(
  raw: unknown,
  kind: BillingDocumentKind,
): BillingDocumentValues | null {
  try {
    const v = record(raw);
    if (v.kind !== kind) return null;
    if (!Array.isArray(v.lines) || v.lines.length === 0 || v.lines.length > MAX_LINES) return null;
    const lines = v.lines.map(line);
    if (new Set(lines.map((l) => l.id)).size !== lines.length) return null;

    const seller = record(v.seller);
    return {
      kind,
      gstMode: oneOf(v.gstMode, ["", "with-gst", "without-gst"] as const),
      seller: { ...party(seller), stateCode: text(seller.stateCode) },
      customer: party(v.customer),
      documentNumber: text(v.documentNumber),
      issueDate: text(v.issueDate),
      dueDate: text(v.dueDate),
      validUntil: text(v.validUntil),
      placeOfSupply: text(v.placeOfSupply),
      recipientIsSez: flag(v.recipientIsSez),
      lines,
      notes: text(v.notes),
      terms: text(v.terms),
      roundOff: flag(v.roundOff),
    };
  } catch (error) {
    if (error instanceof ShapeError) return null;
    throw error;
  }
}

const METHODS = ["", ...PAYMENT_METHODS.map((m) => m.value)] as const;

/** Returns a valid receipt draft, or null. */
export function parseReceiptDraft(raw: unknown): ReceiptValues | null {
  try {
    const v = record(raw);
    return {
      business: contact(v.business),
      receiptNumber: text(v.receiptNumber),
      paymentDate: text(v.paymentDate),
      payer: contact(v.payer),
      amount: text(v.amount),
      method: oneOf(v.method, METHODS),
      reference: text(v.reference),
      againstDocument: text(v.againstDocument),
      note: text(v.note),
      documentTotal: text(v.documentTotal),
      previouslyPaid: text(v.previouslyPaid),
    };
  } catch (error) {
    if (error instanceof ShapeError) return null;
    throw error;
  }
}

/** The next free numeric line id after a restored draft's lines ("line-7" → 8). */
export function nextLineNumber(lines: readonly LineValues[]): number {
  return lines.reduce((max, l) => Math.max(max, Number(l.id.slice(5)) || 0), 0) + 1;
}
