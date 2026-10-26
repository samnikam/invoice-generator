import { HISTORY_KIND_LABELS, matchesSearch, type HistoryRecord } from "@/lib/history/history";

/**
 * PAST CUSTOMERS FROM HISTORY
 * Read-only list of customers that appear in documents the user saved to History in this
 * browser. Nothing is looked up online and nothing is stored: the list is rebuilt from the
 * saved records each time, so it can never contain a customer the user did not enter.
 *
 * The same customer often appears in several documents. They are merged into one entry:
 * - by GSTIN when the document has one (one GSTIN = one registration);
 * - otherwise by name + mobile digits (so two different people with the same name stay
 *   separate when their numbers differ).
 * The details shown and filled in are those from the most recently saved document.
 */
export type PastCustomer = {
  key: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Empty when the customer had no GSTIN (receipts never have one). */
  gstin: string;
  /** Number of saved documents for this customer. */
  documentCount: number;
  /** The most recent saved document for this customer. */
  latest: { kind: string; documentNumber: string; date: string; savedAt: string };
};

/** Mobile digits for matching: "+91 98200-11223", "098200 11223" and "9820011223" are equal. */
function phoneKey(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

function customerOf(record: HistoryRecord) {
  if (record.kind === "receipt") {
    const p = record.values.payer;
    return { name: p.name, address: p.address, phone: p.phone, email: p.email, gstin: "" };
  }
  const c = record.values.customer;
  return { name: c.name, address: c.address, phone: c.phone, email: c.email, gstin: c.gstin };
}

/** Distinct past customers, most recently used first. */
export function pastCustomersFromHistory(records: readonly HistoryRecord[]): PastCustomer[] {
  const byKey = new Map<string, PastCustomer>();
  const newestFirst = [...records].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  for (const record of newestFirst) {
    const raw = customerOf(record);
    const customer = {
      name: raw.name.trim(),
      address: raw.address.trim(),
      phone: raw.phone.trim(),
      email: raw.email.trim(),
      gstin: raw.gstin.trim().toUpperCase(),
    };
    if (customer.name === "") continue; // incomplete record: nothing usable to offer

    const key = customer.gstin
      ? `gstin:${customer.gstin}`
      : `name:${customer.name.toLowerCase().replace(/\s+/g, " ")}|${phoneKey(customer.phone)}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.documentCount += 1; // older copy: keep the newer details already stored
      continue;
    }
    byKey.set(key, {
      key,
      ...customer,
      documentCount: 1,
      latest: {
        kind: HISTORY_KIND_LABELS[record.kind],
        documentNumber: record.summary.documentNumber,
        date: record.summary.date,
        savedAt: record.savedAt,
      },
    });
  }
  return [...byKey.values()];
}

/**
 * Customers whose name contains the search text, or whose mobile number contains it (3+
 * digits; spaces, dashes and +91 ignored) — the same matching rules as the History page.
 * An empty search returns nothing.
 */
export function searchPastCustomers(
  customers: readonly PastCustomer[],
  query: string,
  limit = 8,
): PastCustomer[] {
  if (query.trim() === "") return [];
  return customers
    .filter((c) => matchesSearch({ customerName: c.name, customerPhone: c.phone }, query))
    .slice(0, limit);
}
