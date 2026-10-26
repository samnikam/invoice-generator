import { describe, expect, it } from "vitest";

import { createEmptyDocument, type PartyValues } from "@/lib/documents/billing-document";
import type { HistoryRecord } from "@/lib/history/history";
import { pastCustomersFromHistory, searchPastCustomers } from "@/lib/history/past-customers";
import { createEmptyReceipt, type ContactValues } from "@/lib/receipts/receipt";

let n = 0;
const nextId = () => `record-${String(++n).padStart(4, "0")}`;

function invoice(
  customer: Partial<PartyValues>,
  savedAt: string,
  documentNumber = "INV-1",
): HistoryRecord {
  const values = createEmptyDocument("invoice");
  values.customer = { ...values.customer, ...customer };
  return {
    id: nextId(),
    kind: "invoice",
    savedAt,
    values,
    summary: {
      documentNumber,
      customerName: values.customer.name.trim(),
      customerPhone: values.customer.phone.trim(),
      date: savedAt.slice(0, 10),
      totalPaise: 100,
    },
  };
}

function receipt(payer: Partial<ContactValues>, savedAt: string): HistoryRecord {
  const values = createEmptyReceipt();
  values.payer = { ...values.payer, ...payer };
  return {
    id: nextId(),
    kind: "receipt",
    savedAt,
    values,
    summary: {
      documentNumber: "R-1",
      customerName: values.payer.name.trim(),
      customerPhone: values.payer.phone.trim(),
      date: savedAt.slice(0, 10),
      totalPaise: 100,
    },
  };
}

const GSTIN = "27AAPFU0939F1ZV";

describe("pastCustomersFromHistory", () => {
  it("returns nothing when nothing is saved", () => {
    expect(pastCustomersFromHistory([])).toEqual([]);
  });

  it("merges documents with the same GSTIN and keeps the newest details", () => {
    const customers = pastCustomersFromHistory([
      invoice(
        { name: "Example Retail", address: "Old address", gstin: GSTIN },
        "2026-10-01T10:00:00Z",
        "INV-1",
      ),
      invoice(
        { name: "Example Retail Pvt Ltd", address: "New address", gstin: " 27aapfu0939f1zv " },
        "2026-10-20T10:00:00Z",
        "INV-9",
      ),
    ]);
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({
      name: "Example Retail Pvt Ltd",
      address: "New address",
      gstin: GSTIN,
      documentCount: 2,
      latest: { kind: "Invoice", documentNumber: "INV-9" },
    });
  });

  it("keeps same-named customers apart when their mobile numbers differ", () => {
    const customers = pastCustomersFromHistory([
      receipt({ name: "Asha Patel", phone: "98200 11223" }, "2026-10-01T10:00:00Z"),
      receipt({ name: "asha  patel", phone: "+91 98200-11223" }, "2026-10-02T10:00:00Z"),
      receipt({ name: "Asha Patel", phone: "90000 00001" }, "2026-10-03T10:00:00Z"),
    ]);
    // Same name + same mobile (spaces, case, dashes and +91 ignored) merge; a different
    // number stays a separate customer.
    expect(customers.map((c) => [c.phone, c.documentCount])).toEqual([
      ["90000 00001", 1],
      ["+91 98200-11223", 2],
    ]);
  });

  it("includes receipt payers (without a GSTIN) and lists the most recent first", () => {
    const customers = pastCustomersFromHistory([
      invoice({ name: "Bright Traders" }, "2026-10-01T10:00:00Z"),
      receipt({ name: "Asha Patel", phone: "98200 11223" }, "2026-10-05T10:00:00Z"),
    ]);
    expect(customers.map((c) => c.name)).toEqual(["Asha Patel", "Bright Traders"]);
    expect(customers[0]).toMatchObject({ gstin: "", latest: { kind: "Receipt" } });
  });

  it("handles missing details safely and skips records without a customer name", () => {
    const customers = pastCustomersFromHistory([
      invoice({ name: "  Only Name  " }, "2026-10-01T10:00:00Z"),
      invoice({ name: "   " }, "2026-10-02T10:00:00Z"),
    ]);
    expect(customers).toEqual([
      expect.objectContaining({
        name: "Only Name",
        address: "",
        phone: "",
        email: "",
        gstin: "",
      }),
    ]);
  });

  it("does not change the History records it reads", () => {
    const records = [invoice({ name: "Example Retail", gstin: GSTIN }, "2026-10-01T10:00:00Z")];
    const before = JSON.stringify(records);
    pastCustomersFromHistory(records);
    expect(JSON.stringify(records)).toBe(before);
  });
});

describe("searchPastCustomers", () => {
  const customers = pastCustomersFromHistory([
    invoice(
      { name: "Example Retail Pvt Ltd", phone: "+91 98765 43210", gstin: GSTIN },
      "2026-10-03T10:00:00Z",
    ),
    invoice({ name: "Bright Traders", phone: "022 2345 6789" }, "2026-10-02T10:00:00Z"),
    receipt({ name: "Asha Patel", phone: "98200 11223" }, "2026-10-01T10:00:00Z"),
  ]);
  const names = (query: string) => searchPastCustomers(customers, query).map((c) => c.name);

  it("finds customers by part of the name, ignoring case and spaces", () => {
    expect(names("retail")).toEqual(["Example Retail Pvt Ltd"]);
    expect(names("  BRIGHT ")).toEqual(["Bright Traders"]);
    expect(names("a")).toEqual(["Example Retail Pvt Ltd", "Bright Traders", "Asha Patel"]);
  });

  it("finds customers by part of the mobile number", () => {
    expect(names("98765")).toEqual(["Example Retail Pvt Ltd"]);
    expect(names("+91-98765-43210")).toEqual(["Example Retail Pvt Ltd"]);
    expect(names("2345")).toEqual(["Bright Traders"]);
    expect(names("98")).toEqual([]); // too few digits to search numbers
  });

  it("returns nothing for an empty search or no match, and respects the limit", () => {
    expect(names("")).toEqual([]);
    expect(names("   ")).toEqual([]);
    expect(names("nobody")).toEqual([]);
    expect(searchPastCustomers(customers, "a", 2)).toHaveLength(2);
  });
});
