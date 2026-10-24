"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  FileSearch,
  HardDrive,
  Printer,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { cn } from "cn";

import { KindBadge } from "@/components/history/kind-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentPreview } from "@/features/billing-documents/document-preview";
import { InvoiceDocument } from "@/features/billing-documents/invoice-document";
import { ReceiptPreview } from "@/features/receipts/receipt-preview";
import { formatDisplayDate } from "@/lib/dates";
import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import {
  checkRecord,
  filterRecords,
  HISTORY_KIND_LABELS,
  type EvaluatedDocument,
  type HistoryFilter,
  type HistoryRecord,
} from "@/lib/history/history";
import {
  deleteHistoryRecord,
  listHistory,
  type HistoryListResult,
} from "@/lib/history/history-storage";
import { formatPaise } from "@/lib/money/format";

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "invoice", label: "Invoices" },
  { value: "quotation", label: "Quotations" },
  { value: "receipt", label: "Receipts" },
];

const savedFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Browse, search, open, reprint and delete documents saved to history in this browser.
 * Records are read after the page loads (never during server rendering).
 */
export function HistoryBrowser() {
  const [list, setList] = useState<HistoryListResult | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setList(listHistory(getBrowserStorage())), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only read after load
    refresh();
    // A link such as /history?open=<id> (e.g. from the dashboard) opens that record.
    const requested = new URLSearchParams(window.location.search).get("open");
    if (requested) setOpenId(requested);
    // Another tab may save or delete records.
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [refresh]);

  const records = useMemo(() => (list?.status === "loaded" ? list.records : []), [list]);
  const shown = useMemo(() => filterRecords(records, filter, query), [records, filter, query]);
  const open = openId ? records.find((r) => r.id === openId) : undefined;

  /** A record was requested by link but no longer exists (e.g. it was deleted). */
  const missing = openId !== null && list?.status === "loaded" && !open;

  function closeRecord() {
    setOpenId(null);
    if (new URLSearchParams(window.location.search).has("open")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function deleteRecord(record: HistoryRecord) {
    const label = `${HISTORY_KIND_LABELS[record.kind]} ${record.summary.documentNumber}`;
    const ok = window.confirm(
      `Delete the saved ${label} from history in this browser?\n\nThis cannot be undone. Your drafts and business profile are not affected.`,
    );
    if (!ok) return;
    const deleted = deleteHistoryRecord(getBrowserStorage(), record.id);
    refresh();
    if (deleted) {
      setMessage({ tone: "info", text: `${label} was deleted from history.` });
      closeRecord();
    } else {
      setMessage({
        tone: "error",
        text: "Could not delete the record: this browser is blocking storage. It may still be stored.",
      });
    }
  }

  function deleteDamaged(ids: readonly string[]) {
    const ok = window.confirm(
      `Delete ${ids.length === 1 ? "the 1 unreadable record" : `the ${ids.length} unreadable records`} from history in this browser?\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    const storage = getBrowserStorage();
    const failed = ids.filter((id) => !deleteHistoryRecord(storage, id)).length;
    refresh();
    setMessage(
      failed === 0
        ? { tone: "info", text: "Unreadable records were deleted." }
        : { tone: "error", text: "Some unreadable records could not be deleted." },
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records"
        title="Document history"
        description="Find invoices, quotations and receipts you saved with “Save to history”, open them, and print or save them as PDF again."
      />

      <div
        className="flex gap-2.5 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-card print:hidden"
        data-testid="history-privacy"
      >
        <HardDrive aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          Records are stored{" "}
          <strong className="text-foreground">in this browser on this device only</strong>. They are
          not uploaded, not synced to the cloud or other devices, and not encrypted — anyone who
          uses this browser can see them. Clearing your browser data deletes them. Saving a record
          does not mean the document was sent to the customer.
        </p>
      </div>

      <div role="status" className="print:hidden" data-testid="history-message">
        {message ? (
          <p
            className={cn(
              "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
              message.tone === "error"
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-success/30 bg-success/10",
            )}
          >
            {message.tone === "error" ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : null}
            {message.text}
          </p>
        ) : null}
      </div>

      {list === null ? (
        <p className="text-sm text-muted-foreground">Loading saved documents…</p>
      ) : list.status === "unavailable" ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          History is not available because this browser is blocking storage (for example in some
          private-browsing modes).
        </p>
      ) : open ? (
        <RecordView record={open} onBack={closeRecord} onDelete={() => deleteRecord(open)} />
      ) : (
        <>
          {missing ? (
            <p
              className="flex items-start gap-2 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm"
              data-testid="history-open-missing"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              The saved document you tried to open was not found in this browser. It may have been
              deleted.
            </p>
          ) : null}
          {list.damagedIds.length > 0 ? (
            <div
              className="flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              data-testid="history-damaged"
            >
              <p className="flex items-start gap-2">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {list.damagedIds.length === 1
                  ? "1 saved record could not be read (it may be damaged or from another version). It is kept until you delete it."
                  : `${list.damagedIds.length} saved records could not be read (they may be damaged or from another version). They are kept until you delete them.`}
              </p>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => deleteDamaged(list.damagedIds)}
              >
                Delete unreadable records
              </Button>
            </div>
          ) : null}

          <section
            aria-labelledby="history-list-heading"
            className="rounded-xl border bg-card shadow-card print:hidden"
          >
            <h2
              id="history-list-heading"
              className="flex items-center gap-2.5 border-b px-5 py-3.5 text-[0.95rem] font-semibold tracking-tight"
            >
              <span aria-hidden="true" className="h-4 w-1 rounded-full bg-primary" />
              Saved documents
            </h2>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="history-search">Search by customer name or mobile number</Label>
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      ref={searchRef}
                      id="history-search"
                      type="search"
                      autoComplete="off"
                      placeholder="e.g. Asha or 98200 11223"
                      className="pl-9"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div
                  role="group"
                  aria-label="Document type"
                  className="inline-flex w-full rounded-lg border bg-card p-1 shadow-card md:w-auto"
                >
                  {FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      aria-pressed={filter === f.value}
                      onClick={() => setFilter(f.value)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors md:flex-none",
                        filter === f.value
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <p
                className="text-sm text-muted-foreground"
                aria-live="polite"
                data-testid="history-count"
              >
                {records.length === 0
                  ? "No saved documents yet."
                  : `Showing ${shown.length} of ${records.length} saved ${records.length === 1 ? "document" : "documents"}.`}
              </p>

              {records.length === 0 ? (
                <EmptyHistory />
              ) : shown.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                  <FileSearch aria-hidden="true" className="size-4 shrink-0" />
                  No saved documents match your search.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  {/* Column titles for wider screens (each row also labels its own values). */}
                  <div
                    aria-hidden="true"
                    className="hidden gap-4 border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_7.5rem_8.5rem_5.5rem]"
                  >
                    <span>Document</span>
                    <span>Customer</span>
                    <span>Date</span>
                    <span className="text-right">Amount</span>
                    <span />
                  </div>
                  <ul aria-label="Saved documents" className="divide-y">
                    {shown.map((record) => (
                      <RecordRow
                        key={record.id}
                        record={record}
                        onOpen={() => setOpenId(record.id)}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RecordRow({ record, onOpen }: { record: HistoryRecord; onOpen: () => void }) {
  const { summary } = record;
  return (
    <li
      data-testid="history-record"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-accent/30 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_7.5rem_8.5rem_5.5rem]"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <KindBadge kind={record.kind} />
        <span className="font-semibold break-all" data-testid="history-record-number">
          {summary.documentNumber}
        </span>
      </div>
      <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
        <p className="truncate font-medium" data-testid="history-record-customer">
          {summary.customerName}
        </p>
        {summary.customerPhone ? (
          <p className="truncate text-sm text-muted-foreground">{summary.customerPhone}</p>
        ) : null}
      </div>
      <dl className="contents text-sm">
        <div className="row-start-3 md:row-start-auto">
          <dt className="sr-only">Date</dt>
          <dd className="text-sm text-muted-foreground" data-testid="history-record-date">
            {formatDisplayDate(summary.date)}
          </dd>
        </div>
        <div className="col-start-2 row-start-1 text-right md:col-start-auto md:row-start-auto">
          <dt className="sr-only">{record.kind === "receipt" ? "Amount received" : "Total"}</dt>
          <dd className="font-semibold tabular-nums" data-testid="history-record-total">
            {formatPaise(summary.totalPaise)}
          </dd>
        </div>
      </dl>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="col-start-2 row-start-3 justify-self-end md:col-start-auto md:row-start-auto"
        aria-label={`Open ${HISTORY_KIND_LABELS[record.kind]} ${summary.documentNumber} for ${summary.customerName}`}
        onClick={onOpen}
      >
        Open
      </Button>
    </li>
  );
}

function EmptyHistory() {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      <p>
        Nothing is saved yet. When an invoice, quotation or receipt is finished, choose{" "}
        <strong className="text-foreground">Save to history</strong> to keep a copy here.
      </p>
      <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Link href="/invoices/new" className="font-medium text-primary hover:underline">
          New invoice
        </Link>
        <Link href="/quotations/new" className="font-medium text-primary hover:underline">
          New quotation
        </Link>
        <Link href="/receipts/new" className="font-medium text-primary hover:underline">
          New receipt
        </Link>
      </p>
    </div>
  );
}

function RecordView({
  record,
  onBack,
  onDelete,
}: {
  record: HistoryRecord;
  onBack: () => void;
  onDelete: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const check = useMemo(() => checkRecord(record), [record]);
  const { summary } = record;
  const label = `${HISTORY_KIND_LABELS[record.kind]} ${summary.documentNumber}`;

  useEffect(() => {
    headingRef.current?.focus();
  }, [record.id]);

  function printRecord() {
    const previousTitle = document.title;
    document.title = label;
    window.print();
    document.title = previousTitle;
  }

  return (
    <div className="space-y-5" data-testid="history-record-view">
      <div className="space-y-4 print:hidden">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Back to history
        </Button>
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <KindBadge kind={record.kind} />
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight outline-none"
            >
              {label}
            </h2>
            <p className="text-sm text-muted-foreground">
              {summary.customerName}
              {summary.customerPhone ? ` · ${summary.customerPhone}` : ""} ·{" "}
              {formatDisplayDate(summary.date)} ·{" "}
              <span className="font-medium text-foreground">{formatPaise(summary.totalPaise)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Saved to history on {savedFormatter.format(new Date(record.savedAt))}, in this
              browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" size="lg" onClick={onDelete}>
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
            {check.ok ? (
              <Button type="button" size="lg" onClick={printRecord}>
                <Printer data-icon="inline-start" />
                Print / Save as PDF
              </Button>
            ) : null}
          </div>
        </div>
        {check.ok ? (
          <p className="text-sm text-muted-foreground">
            This is the document exactly as it was saved. To save a PDF, choose “Save as PDF” in the
            print window.
          </p>
        ) : (
          <p
            role="alert"
            data-testid="history-record-changed"
            className="flex items-start gap-2 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            This record can no longer be shown exactly as it was saved, because SmartBill’s
            calculation rules (such as the GST rate list) have changed since. To avoid showing
            different figures, it cannot be printed again. The saved details above are unchanged.
          </p>
        )}
      </div>

      {check.ok ? <SavedDocument evaluated={check.evaluated} /> : null}
    </div>
  );
}

function SavedDocument({ evaluated }: { evaluated: EvaluatedDocument }) {
  if (evaluated.kind === "receipt") {
    return <ReceiptPreview values={evaluated.values} evaluation={evaluated.evaluation} />;
  }
  return evaluated.kind === "invoice" ? (
    <InvoiceDocument values={evaluated.values} evaluation={evaluated.evaluation} />
  ) : (
    <DocumentPreview values={evaluated.values} evaluation={evaluated.evaluation} />
  );
}
