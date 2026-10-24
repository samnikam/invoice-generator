import { HISTORY_KINDS, type HistoryKind, type HistoryRecord } from "@/lib/history/history";

/**
 * DASHBOARD SUMMARIES FROM HISTORY
 * Read-only figures built from documents the user saved to History in this browser.
 * Nothing is estimated or invented.
 *
 * History can hold several saved copies of the same document number (the user confirms
 * each extra copy). For totals, each document (type + number) is counted ONCE, using its
 * most recently saved copy, so a re-saved invoice never doubles the figures.
 */

export type KindTotals = { count: number; totalPaise: number };

export type HistoryOverview = {
  /** Distinct documents (type + number) of each type. */
  allTime: Record<HistoryKind, KindTotals>;
  /** Distinct documents whose document date is in the given month. */
  thisMonth: Record<HistoryKind, KindTotals>;
  /** Number of distinct documents. */
  documentCount: number;
  /** Number of saved records, including extra copies. */
  recordCount: number;
  /** Most recently saved distinct documents, newest first. */
  recent: HistoryRecord[];
};

const emptyTotals = (): Record<HistoryKind, KindTotals> =>
  Object.fromEntries(HISTORY_KINDS.map((k) => [k, { count: 0, totalPaise: 0 }])) as Record<
    HistoryKind,
    KindTotals
  >;

const documentKey = (r: HistoryRecord) =>
  `${r.kind}|${r.summary.documentNumber.trim().toLowerCase()}`;

/** Latest saved copy of each distinct document, newest first. */
export function latestCopies(records: readonly HistoryRecord[]): HistoryRecord[] {
  const latest = new Map<string, HistoryRecord>();
  for (const record of records) {
    const key = documentKey(record);
    const current = latest.get(key);
    if (!current || record.savedAt > current.savedAt) latest.set(key, record);
  }
  return [...latest.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function add(totals: KindTotals, paise: number): void {
  const next = totals.totalPaise + paise;
  // Whole paise stay exact far beyond any real total; refuse to report a wrong figure.
  if (!Number.isSafeInteger(next)) throw new RangeError("History total is too large to show.");
  totals.count += 1;
  totals.totalPaise = next;
}

/**
 * @param today Today's date as YYYY-MM-DD in the user's time zone (decides "this month").
 */
export function summarizeHistory(
  records: readonly HistoryRecord[],
  today: string,
  recentLimit = 5,
): HistoryOverview {
  const month = today.slice(0, 7); // "YYYY-MM"
  const documents = latestCopies(records);
  const allTime = emptyTotals();
  const thisMonth = emptyTotals();
  for (const doc of documents) {
    add(allTime[doc.kind], doc.summary.totalPaise);
    if (doc.summary.date.startsWith(month)) add(thisMonth[doc.kind], doc.summary.totalPaise);
  }
  return {
    allTime,
    thisMonth,
    documentCount: documents.length,
    recordCount: records.length,
    recent: documents.slice(0, recentLimit),
  };
}
