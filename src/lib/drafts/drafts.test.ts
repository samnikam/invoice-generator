import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "@/lib/documents/billing-document";
import {
  nextLineNumber,
  parseBillingDocumentDraft,
  parseReceiptDraft,
} from "@/lib/drafts/draft-shapes";
import {
  deleteDraft,
  draftStorageKey,
  getBrowserStorage,
  readDraft,
  writeDraft,
  type DraftStorage,
} from "@/lib/drafts/draft-storage";
import { createEmptyReceipt } from "@/lib/receipts/receipt";

/** In-memory Storage. `failWith` makes setItem throw, to simulate quota/blocked storage. */
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

const invoiceParse = (raw: unknown) => parseBillingDocumentDraft(raw, "invoice");
const NOW = new Date("2026-10-23T10:42:00.000Z");

describe("draft storage keys", () => {
  it("are versioned and separate for each document type", () => {
    expect(draftStorageKey("invoice")).toBe("smartbill.draft.v1.invoice");
    expect(draftStorageKey("quotation")).toBe("smartbill.draft.v1.quotation");
    expect(draftStorageKey("receipt")).toBe("smartbill.draft.v1.receipt");
  });
});

describe("writeDraft / readDraft", () => {
  it("round-trips a draft exactly, with its save time", () => {
    const storage = memoryStorage();
    const values = { ...createEmptyDocument("invoice"), documentNumber: "INV-1" };
    values.lines = [{ ...values.lines[0]!, unitPrice: "1250.50", quantity: "1.5" }];
    expect(writeDraft(storage, "invoice", values, NOW)).toEqual({
      ok: true,
      savedAt: "2026-10-23T10:42:00.000Z",
    });
    expect(JSON.parse(storage.data.get("smartbill.draft.v1.invoice")!)).toMatchObject({
      version: 1,
      kind: "invoice",
      savedAt: "2026-10-23T10:42:00.000Z",
    });
    expect(readDraft(storage, "invoice", invoiceParse)).toEqual({
      status: "restored",
      values,
      savedAt: "2026-10-23T10:42:00.000Z",
    });
  });

  it("keeps invoice, quotation and receipt drafts apart", () => {
    const storage = memoryStorage();
    writeDraft(storage, "invoice", createEmptyDocument("invoice"));
    writeDraft(storage, "receipt", createEmptyReceipt());
    expect([...storage.data.keys()].sort()).toEqual([
      "smartbill.draft.v1.invoice",
      "smartbill.draft.v1.receipt",
    ]);
    expect(
      readDraft(storage, "quotation", (r) => parseBillingDocumentDraft(r, "quotation")),
    ).toEqual({
      status: "none",
    });
    expect(readDraft(storage, "receipt", parseReceiptDraft).status).toBe("restored");
  });

  it("returns 'none' when nothing is stored", () => {
    expect(readDraft(memoryStorage(), "invoice", invoiceParse)).toEqual({ status: "none" });
  });

  it.each([
    ["not JSON", "{oops"],
    ["JSON but not an object", "42"],
    ["missing values", JSON.stringify({ version: 1, kind: "invoice", savedAt: NOW.toISOString() })],
    [
      "outdated version",
      JSON.stringify({ version: 0, kind: "invoice", savedAt: NOW.toISOString(), values: {} }),
    ],
    [
      "future version",
      JSON.stringify({ version: 2, kind: "invoice", savedAt: NOW.toISOString(), values: {} }),
    ],
    [
      "wrong document type",
      JSON.stringify({
        version: 1,
        kind: "receipt",
        savedAt: NOW.toISOString(),
        values: createEmptyDocument("invoice"),
      }),
    ],
    [
      "bad save time",
      JSON.stringify({
        version: 1,
        kind: "invoice",
        savedAt: "yesterday",
        values: createEmptyDocument("invoice"),
      }),
    ],
    [
      "values of the wrong shape",
      JSON.stringify({
        version: 1,
        kind: "invoice",
        savedAt: NOW.toISOString(),
        values: { hello: "world" },
      }),
    ],
  ])("reports 'invalid' (never throws) for %s", (_label, stored) => {
    const storage = memoryStorage();
    storage.data.set("smartbill.draft.v1.invoice", stored);
    expect(readDraft(storage, "invoice", invoiceParse)).toEqual({ status: "invalid" });
  });

  it("reports a draft left by another version as 'invalid' rather than ignoring it", () => {
    const storage = memoryStorage();
    storage.data.set("smartbill.draft.v0.invoice", "{}");
    expect(readDraft(storage, "invoice", invoiceParse)).toEqual({ status: "invalid" });
  });

  it("reports unavailable storage", () => {
    expect(readDraft(null, "invoice", invoiceParse)).toEqual({ status: "unavailable" });
    expect(writeDraft(null, "invoice", {})).toEqual({ ok: false, reason: "unavailable" });
  });

  it("recognises a full-storage (quota) error", () => {
    const quota = memoryStorage(() => new DOMException("full", "QuotaExceededError"));
    expect(writeDraft(quota, "invoice", {})).toEqual({ ok: false, reason: "quota" });
    const firefoxQuota = memoryStorage(
      () => new DOMException("full", "NS_ERROR_DOM_QUOTA_REACHED"),
    );
    expect(writeDraft(firefoxQuota, "invoice", {})).toEqual({ ok: false, reason: "quota" });
    const refused = memoryStorage(() => new DOMException("denied", "SecurityError"));
    expect(writeDraft(refused, "invoice", {})).toEqual({ ok: false, reason: "unavailable" });
    const other = memoryStorage(() => new Error("blocked"));
    expect(writeDraft(other, "invoice", {})).toEqual({ ok: false, reason: "error" });
  });

  it("reading never writes: readDraft only calls getItem/key/length", () => {
    const storage = memoryStorage(() => new Error("no writes allowed"));
    storage.data.set("smartbill.draft.v1.invoice", "{bad");
    expect(readDraft(storage, "invoice", invoiceParse)).toEqual({ status: "invalid" });
    expect(readDraft(storage, "receipt", parseReceiptDraft)).toEqual({ status: "none" });
    expect([...storage.data.keys()]).toEqual(["smartbill.draft.v1.invoice"]);
  });

  it("getBrowserStorage returns null outside the browser", () => {
    expect(getBrowserStorage()).toBeNull();
  });
});

describe("deleteDraft", () => {
  it("removes only the chosen document type, including other-version copies", () => {
    const storage = memoryStorage();
    writeDraft(storage, "invoice", createEmptyDocument("invoice"));
    writeDraft(storage, "quotation", createEmptyDocument("quotation"));
    writeDraft(storage, "receipt", createEmptyReceipt());
    storage.data.set("smartbill.draft.v0.invoice", "{}");
    storage.data.set("unrelated.key", "keep me");

    expect(deleteDraft(storage, "invoice")).toBe(true);
    expect([...storage.data.keys()].sort()).toEqual([
      "smartbill.draft.v1.quotation",
      "smartbill.draft.v1.receipt",
      "unrelated.key",
    ]);
  });
});

describe("deleteDraft reports failure honestly", () => {
  it("returns false (and keeps the draft) when the browser refuses the deletion", () => {
    const storage = memoryStorage();
    writeDraft(storage, "invoice", createEmptyDocument("invoice"));
    storage.removeItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    expect(deleteDraft(storage, "invoice")).toBe(false);
    expect(storage.data.has("smartbill.draft.v1.invoice")).toBe(true);
  });

  it("returns false when the deletion is silently ignored (checked by reading back)", () => {
    const storage = memoryStorage();
    writeDraft(storage, "invoice", createEmptyDocument("invoice"));
    storage.removeItem = () => {};
    expect(deleteDraft(storage, "invoice")).toBe(false);
  });

  it("returns false when storage is unavailable", () => {
    expect(deleteDraft(null, "invoice")).toBe(false);
  });

  it("returns true when there was nothing to delete", () => {
    expect(deleteDraft(memoryStorage(), "receipt")).toBe(true);
  });
});

describe("draft shape checks", () => {
  it("accepts a valid quotation and rejects it as an invoice", () => {
    const quotation = createEmptyDocument("quotation");
    expect(parseBillingDocumentDraft(quotation, "quotation")).toEqual(quotation);
    expect(parseBillingDocumentDraft(quotation, "invoice")).toBeNull();
  });

  it("drops unknown fields instead of restoring them", () => {
    const withExtra = { ...createEmptyReceipt(), injected: "<script>", amount: "100" };
    expect(parseReceiptDraft(withExtra)).toEqual({ ...createEmptyReceipt(), amount: "100" });
  });

  it("keeps entered amounts exactly as typed (no rounding or reformatting)", () => {
    const receipt = { ...createEmptyReceipt(), amount: "1000.5", documentTotal: "0001234.50" };
    expect(parseReceiptDraft(receipt)).toMatchObject({
      amount: "1000.5",
      documentTotal: "0001234.50",
    });
  });

  it.each([
    [
      "a number where text is expected",
      (d: Record<string, unknown>) => ({ ...d, documentNumber: 42 }),
    ],
    ["an unknown GST mode", (d: Record<string, unknown>) => ({ ...d, gstMode: "maybe" })],
    ["no line items", (d: Record<string, unknown>) => ({ ...d, lines: [] })],
    [
      "a malformed line id",
      (d: Record<string, unknown>) => ({ ...d, lines: [{ ...(d.lines as object[])[0], id: "x" }] }),
    ],
    [
      "duplicate line ids",
      (d: Record<string, unknown>) => ({
        ...d,
        lines: [(d.lines as object[])[0], (d.lines as object[])[0]],
      }),
    ],
    [
      "an unknown discount type",
      (d: Record<string, unknown>) => ({
        ...d,
        lines: [{ ...(d.lines as object[])[0], discountKind: "bogo" }],
      }),
    ],
    [
      "an unknown GST treatment",
      (d: Record<string, unknown>) => ({
        ...d,
        lines: [{ ...(d.lines as object[])[0], treatment: "free" }],
      }),
    ],
    ["a non-boolean round-off flag", (d: Record<string, unknown>) => ({ ...d, roundOff: "yes" })],
    ["oversized text", (d: Record<string, unknown>) => ({ ...d, notes: "x".repeat(5001) })],
    ["null", () => null],
    ["an array", () => []],
  ])("rejects an invoice draft with %s", (_label, mutate) => {
    const base = createEmptyDocument("invoice") as unknown as Record<string, unknown>;
    expect(parseBillingDocumentDraft(mutate(base), "invoice")).toBeNull();
  });

  it("rejects a receipt draft with an unknown payment method or missing fields", () => {
    expect(parseReceiptDraft({ ...createEmptyReceipt(), method: "crypto" })).toBeNull();
    const { payer: _payer, ...missingPayer } = createEmptyReceipt();
    void _payer;
    expect(parseReceiptDraft(missingPayer)).toBeNull();
  });

  it("finds the next free line id after restoring", () => {
    const lines = ["line-1", "line-7", "line-3"].map((id) => ({
      ...createEmptyDocument("invoice").lines[0]!,
      id,
    }));
    expect(nextLineNumber(lines)).toBe(8);
  });
});
