import { describe, expect, it } from "vitest";

import {
  createEmptyDocument,
  createEmptyLine,
  type BillingDocumentValues,
} from "@/lib/documents/billing-document";
import { draftStorageKey, writeDraft, type DraftStorage } from "@/lib/drafts/draft-storage";
import {
  checkRecord,
  filterRecords,
  findSameNumber,
  matchesSearch,
  summarize,
  type HistoryRecord,
} from "@/lib/history/history";
import {
  deleteHistoryRecord,
  historyRecordKey,
  listHistory,
  saveToHistory,
} from "@/lib/history/history-storage";
import { PROFILE_STORAGE_KEY } from "@/lib/profile/profile-storage";
import { createEmptyReceipt, type ReceiptValues } from "@/lib/receipts/receipt";

function memoryStorage(failWith?: () => Error): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (failWith) throw failWith();
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

const LOGO = "data:image/png;base64,iVBORw0KGgo=";
const OTHER_LOGO = "data:image/png;base64,iVBORw0KGgoAAAA=";

/** ₹1,000 at 18% within Maharashtra → CGST ₹90 + SGST ₹90 → ₹1,180.00 (118000 paise). */
function invoice(overrides: Partial<BillingDocumentValues> = {}): BillingDocumentValues {
  const base = createEmptyDocument("invoice");
  return {
    ...base,
    gstMode: "with-gst",
    seller: { ...base.seller, name: "Sample Design Studio", address: "Pune", stateCode: "27" },
    customer: { ...base.customer, name: "Example Retail Pvt Ltd", phone: "+91 98765 43210" },
    documentNumber: "INV-2026/001",
    issueDate: "2026-10-24",
    placeOfSupply: "27",
    lines: [
      {
        ...createEmptyLine("line-1"),
        description: "Consulting",
        unitPrice: "1000",
        treatment: "taxable",
        rateId: "18",
      },
    ],
    ...overrides,
  };
}

function quotation(): BillingDocumentValues {
  return {
    ...invoice(),
    kind: "quotation",
    documentNumber: "QT-2026/007",
    customer: { ...invoice().customer, name: "Bright Traders", phone: "022 2345 6789" },
  };
}

/** ₹2,500.50 by UPI. */
function receipt(overrides: Partial<ReceiptValues> = {}): ReceiptValues {
  const base = createEmptyReceipt();
  return {
    ...base,
    business: { ...base.business, name: "Sample Design Studio" },
    receiptNumber: "RCPT-001",
    paymentDate: "2026-10-23",
    payer: { ...base.payer, name: "Asha Patel", phone: "98200 11223" },
    amount: "2500.50",
    method: "upi",
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso);

function saveOk(storage: DraftStorage, doc: Parameters<typeof saveToHistory>[1], when?: Date) {
  const result = saveToHistory(storage, doc, when);
  if (!result.ok) throw new Error(`save failed: ${result.reason}`);
  return result.record;
}

describe("summarize", () => {
  it("captures number, customer, mobile, date and total of a finished document", () => {
    expect(summarize({ kind: "invoice", values: invoice() })).toEqual({
      documentNumber: "INV-2026/001",
      customerName: "Example Retail Pvt Ltd",
      customerPhone: "+91 98765 43210",
      date: "2026-10-24",
      totalPaise: 118000,
    });
    expect(summarize({ kind: "receipt", values: receipt() })).toEqual({
      documentNumber: "RCPT-001",
      customerName: "Asha Patel",
      customerPhone: "98200 11223",
      date: "2026-10-23",
      totalPaise: 250050,
    });
  });

  it("returns null for an incomplete document (the same rule that blocks printing)", () => {
    expect(summarize({ kind: "invoice", values: invoice({ documentNumber: "" }) })).toBeNull();
    expect(summarize({ kind: "invoice", values: invoice({ placeOfSupply: "" }) })).toBeNull();
    expect(summarize({ kind: "receipt", values: receipt({ amount: "0" }) })).toBeNull();
  });
});

describe("saving and reading history", () => {
  const NOW = at("2026-10-24T10:00:00.000Z");

  it("saves a snapshot and reads it back exactly, without touching drafts or the profile", () => {
    const storage = memoryStorage();
    writeDraft(storage, "invoice", invoice());
    storage.data.set(PROFILE_STORAGE_KEY, "profile stays");
    const draftBefore = storage.data.get(draftStorageKey("invoice"));

    const values = invoice();
    const record = saveOk(storage, { kind: "invoice", values }, NOW);
    expect(record.savedAt).toBe(NOW.toISOString());
    expect(record.values).toEqual(values);

    // Later edits to the form's values do not change the saved record.
    values.customer.name = "Changed later";
    values.lines[0]!.unitPrice = "9999";
    const list = listHistory(storage);
    expect(list.status).toBe("loaded");
    if (list.status !== "loaded") return;
    expect(list.damagedIds).toEqual([]);
    expect(list.records).toHaveLength(1);
    expect(list.records[0]!.values).toEqual(invoice());
    expect(list.records[0]!.summary.totalPaise).toBe(118000);

    expect(storage.data.get(draftStorageKey("invoice"))).toBe(draftBefore);
    expect(storage.data.get(PROFILE_STORAGE_KEY)).toBe("profile stays");
  });

  it("saves all three document types and lists them newest first", () => {
    const storage = memoryStorage();
    saveOk(storage, { kind: "invoice", values: invoice() }, at("2026-10-24T09:00:00Z"));
    saveOk(storage, { kind: "receipt", values: receipt() }, at("2026-10-24T11:00:00Z"));
    saveOk(storage, { kind: "quotation", values: quotation() }, at("2026-10-24T10:00:00Z"));
    const list = listHistory(storage);
    if (list.status !== "loaded") throw new Error("unavailable");
    expect(list.records.map((r) => r.kind)).toEqual(["receipt", "quotation", "invoice"]);
  });

  it("never overwrites: saving the same document twice keeps two records", () => {
    const storage = memoryStorage();
    saveOk(storage, { kind: "invoice", values: invoice() }, NOW);
    saveOk(storage, { kind: "invoice", values: invoice() }, NOW);
    const list = listHistory(storage);
    if (list.status !== "loaded") throw new Error("unavailable");
    expect(list.records).toHaveLength(2);
    expect(new Set(list.records.map((r) => r.id)).size).toBe(2);
  });

  it("refuses incomplete documents and writes nothing", () => {
    const storage = memoryStorage();
    expect(
      saveToHistory(storage, {
        kind: "invoice",
        values: invoice({ customer: invoice({}).customer, documentNumber: "" }),
      }),
    ).toEqual({
      ok: false,
      reason: "incomplete",
    });
    expect(storage.data.size).toBe(0);
  });

  it("reports blocked, full and silently ignored storage without leaving data behind", () => {
    expect(saveToHistory(null, { kind: "receipt", values: receipt() })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const full = memoryStorage(() => new DOMException("full", "QuotaExceededError"));
    expect(saveToHistory(full, { kind: "invoice", values: invoice({ sellerLogo: LOGO }) })).toEqual(
      { ok: false, reason: "quota" },
    );
    expect(full.data.size).toBe(0);
    expect(listHistory(null)).toEqual({ status: "unavailable" });

    const ignoring = memoryStorage();
    ignoring.setItem = () => {};
    expect(saveToHistory(ignoring, { kind: "receipt", values: receipt() })).toEqual({
      ok: false,
      reason: "error",
    });
  });

  it("removes a newly stored logo again when the record itself cannot be saved", () => {
    const storage = memoryStorage();
    const setItem = storage.setItem;
    storage.setItem = (k, v) => {
      if (k.includes(".doc.")) throw new DOMException("full", "QuotaExceededError");
      setItem(k, v);
    };
    expect(
      saveToHistory(storage, { kind: "invoice", values: invoice({ sellerLogo: LOGO }) }),
    ).toEqual({ ok: false, reason: "quota" });
    expect(storage.data.size).toBe(0);
  });
});

describe("shared logos", () => {
  const logoKeys = (storage: { data: Map<string, string> }) =>
    [...storage.data.keys()].filter((k) => k.startsWith("smartbill.history.v1.logo."));

  it("stores a logo once for many records, restores it, and removes it when unused", () => {
    const storage = memoryStorage();
    const a = saveOk(storage, { kind: "invoice", values: invoice({ sellerLogo: LOGO }) });
    const b = saveOk(storage, { kind: "invoice", values: invoice({ sellerLogo: LOGO }) });
    const c = saveOk(storage, { kind: "invoice", values: invoice({ sellerLogo: OTHER_LOGO }) });
    expect(logoKeys(storage)).toHaveLength(2);
    // The record itself holds only a reference, never the image.
    expect(storage.data.get(historyRecordKey(a.id))).not.toContain("base64");

    const list = listHistory(storage);
    if (list.status !== "loaded") throw new Error("unavailable");
    expect(list.records.find((r) => r.id === a.id)?.values).toMatchObject({ sellerLogo: LOGO });
    expect(list.records.find((r) => r.id === c.id)?.values).toMatchObject({
      sellerLogo: OTHER_LOGO,
    });

    expect(deleteHistoryRecord(storage, a.id)).toBe(true);
    expect(logoKeys(storage)).toHaveLength(2); // b still uses LOGO
    expect(deleteHistoryRecord(storage, b.id)).toBe(true);
    expect(logoKeys(storage)).toHaveLength(1);
    expect(deleteHistoryRecord(storage, c.id)).toBe(true);
    expect(storage.data.size).toBe(0);
  });

  it("keeps logos while an unreadable record might still use them", () => {
    const storage = memoryStorage();
    const a = saveOk(storage, { kind: "invoice", values: invoice({ sellerLogo: LOGO }) });
    storage.data.set(historyRecordKey("damaged-record-1"), "{oops");
    expect(deleteHistoryRecord(storage, a.id)).toBe(true);
    expect(logoKeys(storage)).toHaveLength(1);
  });
});

describe("damaged records", () => {
  it.each([
    ["not JSON", "{oops"],
    ["wrong version", JSON.stringify({ version: 2 })],
    ["unknown type", JSON.stringify({ version: 1, id: "abcdefgh-1", kind: "bill" })],
  ])("lists a damaged record (%s) by id without affecting others", (_label, raw) => {
    const storage = memoryStorage();
    const good = saveOk(storage, { kind: "receipt", values: receipt() });
    storage.data.set(historyRecordKey("abcdefgh-1"), raw);
    const list = listHistory(storage);
    if (list.status !== "loaded") throw new Error("unavailable");
    expect(list.records.map((r) => r.id)).toEqual([good.id]);
    expect(list.damagedIds).toEqual(["abcdefgh-1"]);
    // Damaged records are never deleted automatically.
    expect(storage.data.has(historyRecordKey("abcdefgh-1"))).toBe(true);
  });

  it("treats a record with a bad summary, bad values or a missing logo as damaged", () => {
    const storage = memoryStorage();
    const r = saveOk(storage, { kind: "invoice", values: invoice({ sellerLogo: LOGO }) });
    const stored = JSON.parse(storage.data.get(historyRecordKey(r.id))!);

    for (const broken of [
      { ...stored, summary: { ...stored.summary, totalPaise: -5 } },
      { ...stored, values: { ...stored.values, lines: "nope" } },
      { ...stored, logo: "ffffffff" },
    ]) {
      storage.data.set(historyRecordKey(r.id), JSON.stringify(broken));
      const list = listHistory(storage);
      if (list.status !== "loaded") throw new Error("unavailable");
      expect(list.damagedIds).toEqual([r.id]);
    }
  });

  it("deletes a damaged record on request, and reports an ignored deletion", () => {
    const storage = memoryStorage();
    storage.data.set(historyRecordKey("abcdefgh-1"), "{oops");
    expect(deleteHistoryRecord(storage, "abcdefgh-1")).toBe(true);
    expect(storage.data.size).toBe(0);

    const ignoring = memoryStorage();
    const r = saveOk(ignoring, { kind: "receipt", values: receipt() });
    ignoring.removeItem = () => {};
    expect(deleteHistoryRecord(ignoring, r.id)).toBe(false);
    expect(deleteHistoryRecord(null, r.id)).toBe(false);
  });
});

describe("checkRecord", () => {
  it("confirms a record that still produces its saved figures", () => {
    const storage = memoryStorage();
    const record = saveOk(storage, { kind: "invoice", values: invoice() });
    expect(checkRecord(record).ok).toBe(true);
  });

  it("flags a record whose figures would now differ, instead of showing new ones", () => {
    const storage = memoryStorage();
    const record = saveOk(storage, { kind: "invoice", values: invoice() });
    const changed: HistoryRecord = { ...record, summary: { ...record.summary, totalPaise: 100 } };
    expect(checkRecord(changed)).toEqual({ ok: false, reason: "changed" });
    const incomplete = {
      ...record,
      values: { ...invoice(), lines: [{ ...invoice().lines[0]!, rateId: "no-longer-exists" }] },
    } as HistoryRecord;
    expect(checkRecord(incomplete)).toEqual({ ok: false, reason: "incomplete" });
  });
});

describe("searching and filtering", () => {
  const storage = memoryStorage();
  const inv = saveOk(storage, { kind: "invoice", values: invoice() }, at("2026-10-24T09:00:00Z"));
  const quo = saveOk(
    storage,
    { kind: "quotation", values: quotation() },
    at("2026-10-24T10:00:00Z"),
  );
  const rec = saveOk(storage, { kind: "receipt", values: receipt() }, at("2026-10-24T11:00:00Z"));
  const all = [inv, quo, rec];
  const ids = (records: HistoryRecord[]) => records.map((r) => r.id);

  it("finds customers by part of the name, ignoring case and spaces", () => {
    expect(ids(filterRecords(all, "all", "example retail"))).toEqual([inv.id]);
    expect(ids(filterRecords(all, "all", "  ASHA   "))).toEqual([rec.id]);
    expect(ids(filterRecords(all, "all", "trad"))).toEqual([quo.id]);
    expect(ids(filterRecords(all, "all", "nobody"))).toEqual([]);
  });

  it("finds customers by mobile number, ignoring spaces, dashes and +91", () => {
    expect(ids(filterRecords(all, "all", "9876543210"))).toEqual([inv.id]);
    expect(ids(filterRecords(all, "all", "+91-98765-43210"))).toEqual([inv.id]);
    expect(ids(filterRecords(all, "all", "98200 112"))).toEqual([rec.id]);
    expect(ids(filterRecords(all, "all", "2345"))).toEqual([quo.id]);
    // One or two digits are too short to search numbers with.
    expect(matchesSearch(inv.summary, "98")).toBe(false);
  });

  it("filters by type and shows everything, newest first, with an empty search", () => {
    expect(ids(filterRecords(all, "invoice", ""))).toEqual([inv.id]);
    expect(ids(filterRecords(all, "quotation", ""))).toEqual([quo.id]);
    expect(ids(filterRecords(all, "receipt", "asha"))).toEqual([rec.id]);
    expect(ids(filterRecords(all, "receipt", "example"))).toEqual([]);
    expect(ids(filterRecords(all, "all", ""))).toEqual([rec.id, quo.id, inv.id]);
  });

  it("finds earlier records with the same type and number", () => {
    expect(ids(findSameNumber(all, "invoice", " inv-2026/001 "))).toEqual([inv.id]);
    expect(findSameNumber(all, "quotation", "INV-2026/001")).toEqual([]);
  });
});
