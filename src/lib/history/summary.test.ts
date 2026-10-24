import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "@/lib/documents/billing-document";
import type { HistoryKind, HistoryRecord, HistorySummary } from "@/lib/history/history";
import { latestCopies, summarizeHistory } from "@/lib/history/summary";
import { createEmptyReceipt } from "@/lib/receipts/receipt";

let n = 0;
/** A saved record with only the fields the summaries use. */
function record(
  kind: HistoryKind,
  documentNumber: string,
  date: string,
  totalPaise: number,
  savedAt: string,
): HistoryRecord {
  const summary: HistorySummary = {
    documentNumber,
    customerName: "Example Customer",
    customerPhone: "",
    date,
    totalPaise,
  };
  n += 1;
  const id = `record-${String(n).padStart(4, "0")}`;
  return kind === "receipt"
    ? { id, kind, savedAt, summary, values: createEmptyReceipt() }
    : { id, kind, savedAt, summary, values: createEmptyDocument(kind) };
}

const TODAY = "2026-10-24";

describe("summarizeHistory", () => {
  it("returns zeros and nothing recent when nothing is saved", () => {
    const o = summarizeHistory([], TODAY);
    expect(o.documentCount).toBe(0);
    expect(o.recordCount).toBe(0);
    expect(o.recent).toEqual([]);
    expect(o.thisMonth.invoice).toEqual({ count: 0, totalPaise: 0 });
    expect(o.allTime.receipt).toEqual({ count: 0, totalPaise: 0 });
  });

  it("adds totals per type, for this month (by document date) and all time", () => {
    const o = summarizeHistory(
      [
        record("invoice", "INV-1", "2026-10-02", 118000, "2026-10-02T10:00:00Z"),
        record("invoice", "INV-2", "2026-10-20", 885000, "2026-10-20T10:00:00Z"),
        record("invoice", "INV-0", "2026-09-30", 50000, "2026-10-21T10:00:00Z"), // dated last month
        record("quotation", "QT-1", "2026-10-05", 250000, "2026-10-05T10:00:00Z"),
        record("receipt", "R-1", "2026-10-23", 250050, "2026-10-23T10:00:00Z"),
      ],
      TODAY,
    );
    // ₹1,180 + ₹8,850 = ₹10,030 this month; plus ₹500 last month = ₹10,530 all time.
    expect(o.thisMonth.invoice).toEqual({ count: 2, totalPaise: 1003000 });
    expect(o.allTime.invoice).toEqual({ count: 3, totalPaise: 1053000 });
    expect(o.thisMonth.quotation).toEqual({ count: 1, totalPaise: 250000 });
    expect(o.thisMonth.receipt).toEqual({ count: 1, totalPaise: 250050 });
    expect(o.documentCount).toBe(5);
  });

  it("counts a re-saved document number once, using its latest copy", () => {
    const o = summarizeHistory(
      [
        record("invoice", "INV-1", "2026-10-02", 118000, "2026-10-02T10:00:00Z"),
        record("invoice", " inv-1 ", "2026-10-02", 236000, "2026-10-03T10:00:00Z"), // newer copy
        record("quotation", "INV-1", "2026-10-02", 1000, "2026-10-01T10:00:00Z"), // other type
      ],
      TODAY,
    );
    expect(o.recordCount).toBe(3);
    expect(o.documentCount).toBe(2);
    expect(o.thisMonth.invoice).toEqual({ count: 1, totalPaise: 236000 });
    expect(o.recent.map((r) => r.summary.totalPaise)).toEqual([236000, 1000]);
  });

  it("lists the most recently saved documents first, up to the limit", () => {
    const records = Array.from({ length: 7 }, (_, i) =>
      record("receipt", `R-${i}`, "2026-10-01", 100, `2026-10-0${i + 1}T10:00:00Z`),
    );
    const o = summarizeHistory(records, TODAY);
    expect(o.recent.map((r) => r.summary.documentNumber)).toEqual([
      "R-6",
      "R-5",
      "R-4",
      "R-3",
      "R-2",
    ]);
  });

  it("refuses to report a total that would no longer be exact", () => {
    const big = Number.MAX_SAFE_INTEGER - 10;
    expect(() =>
      summarizeHistory(
        [
          record("invoice", "A", "2026-10-01", big, "2026-10-01T10:00:00Z"),
          record("invoice", "B", "2026-10-01", 100, "2026-10-02T10:00:00Z"),
        ],
        TODAY,
      ),
    ).toThrow(RangeError);
  });
});

describe("latestCopies", () => {
  it("keeps one record per type and number", () => {
    const a = record("invoice", "X", "2026-10-01", 1, "2026-10-01T00:00:00Z");
    const b = record("invoice", "X", "2026-10-01", 2, "2026-10-05T00:00:00Z");
    const c = record("receipt", "X", "2026-10-01", 3, "2026-10-03T00:00:00Z");
    expect(latestCopies([a, b, c]).map((r) => r.id)).toEqual([b.id, c.id]);
  });
});
