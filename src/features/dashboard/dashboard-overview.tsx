"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  FilePlus2,
  FileText,
  Files,
  MessageSquareQuote,
  ReceiptIndianRupee,
} from "lucide-react";
import { cn } from "cn";

import { NewDocumentLink } from "@/components/documents/new-document-link";
import { KindBadge } from "@/components/history/kind-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { Panel } from "@/components/layout/panel";
import { StatCard } from "@/components/layout/stat-card";
import { useSavedProfile } from "@/components/profile/use-saved-profile";
import { Button } from "@/components/ui/button";
import { formatDisplayDate, todayIsoDate } from "@/lib/dates";
import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import { HISTORY_KIND_LABELS } from "@/lib/history/history";
import { listHistory } from "@/lib/history/history-storage";
import { summarizeHistory, type HistoryOverview } from "@/lib/history/summary";
import { formatPaise } from "@/lib/money/format";

type OverviewState =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "error" }
  | { state: "loaded"; overview: HistoryOverview; monthName: string };

/** Reads History in this browser after the page loads (read-only) and summarises it. */
function useHistoryOverview(): OverviewState {
  const [result, setResult] = useState<OverviewState>({ state: "loading" });

  const refresh = useCallback(() => {
    const list = listHistory(getBrowserStorage());
    if (list.status !== "loaded") {
      setResult({ state: "unavailable" });
      return;
    }
    try {
      const today = todayIsoDate();
      const monthName = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(
        new Date(`${today}T12:00:00`),
      );
      setResult({ state: "loaded", overview: summarizeHistory(list.records, today), monthName });
    } catch {
      setResult({ state: "error" });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only read after load
    refresh();
    window.addEventListener("storage", refresh); // another tab saved or deleted something
    return () => window.removeEventListener("storage", refresh);
  }, [refresh]);

  return result;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The saved business name under the dashboard title (or the default description). */
export function BusinessGreeting() {
  const saved = useSavedProfile();
  if (saved.state === "loaded") {
    return (
      <>
        <span className="font-medium text-foreground">{saved.profile.name}</span> · invoices,
        quotations, receipts and business calculators in one place.
      </>
    );
  }
  return <>Your workspace for invoices, quotations, receipts and business calculators.</>;
}

export function DashboardOverview() {
  const data = useHistoryOverview();
  const saved = useSavedProfile();

  return (
    <div className="space-y-6">
      <SummaryCards data={data} />
      <div className="grid gap-6 lg:grid-cols-3">
        <RecentDocuments data={data} className="lg:col-span-2" />
        <GettingStarted
          profileSaved={saved.state === "loaded"}
          logoAdded={saved.state === "loaded" && saved.logo !== null}
          documentSaved={data.state === "loaded" && data.overview.recordCount > 0}
          ready={saved.state !== "checking" && data.state !== "loading"}
        />
      </div>
    </div>
  );
}

function SummaryCards({ data }: { data: OverviewState }) {
  if (data.state === "loading") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <p className="sr-only" role="status">
          Loading summaries…
        </p>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-[7.75rem] animate-pulse rounded-xl border bg-card shadow-card motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (data.state !== "loaded") {
    return (
      <p
        className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm"
        data-testid="dashboard-summary-unavailable"
      >
        {data.state === "unavailable"
          ? "Summaries are not available because this browser is not allowing SmartBill to read its saved data."
          : "Summaries could not be calculated from the saved documents."}
      </p>
    );
  }

  const { thisMonth, documentCount } = data.overview;
  const month = data.monthName;
  return (
    <section aria-labelledby="summary-heading" className="space-y-3">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Invoiced in ${month}`}
          value={formatPaise(thisMonth.invoice.totalPaise)}
          detail={plural(thisMonth.invoice.count, "invoice")}
          icon={FileText}
          testId="stat-invoices"
        />
        <StatCard
          label={`Received in ${month}`}
          value={formatPaise(thisMonth.receipt.totalPaise)}
          detail={plural(thisMonth.receipt.count, "receipt")}
          icon={ReceiptIndianRupee}
          tone="success"
          testId="stat-receipts"
        />
        <StatCard
          label={`Quoted in ${month}`}
          value={formatPaise(thisMonth.quotation.totalPaise)}
          detail={plural(thisMonth.quotation.count, "quotation")}
          icon={MessageSquareQuote}
          tone="info"
          testId="stat-quotations"
        />
        <StatCard
          label="Saved documents"
          value={String(documentCount)}
          detail="Kept in this browser"
          icon={Files}
          tone="neutral"
          testId="stat-documents"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Figures come only from documents saved with “Save to history” in this browser, by document
        date. Each document number is counted once (its latest saved copy).
      </p>
    </section>
  );
}

function RecentDocuments({ data, className }: { data: OverviewState; className?: string }) {
  const recent = data.state === "loaded" ? data.overview.recent : [];
  return (
    <Panel
      id="recent-heading"
      title="Recently saved"
      className={className}
      bodyClassName="p-0"
      action={
        recent.length > 0 ? (
          <Link
            href="/history"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            See all<span className="sr-only"> saved documents</span>
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null
      }
    >
      {data.state === "loading" ? (
        <div aria-hidden="true" className="space-y-px p-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={FilePlus2}
            title="No saved documents yet"
            actions={
              <>
                <Button asChild size="lg">
                  <NewDocumentLink href="/invoices/new" kind="invoice">
                    Create an invoice
                  </NewDocumentLink>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <NewDocumentLink href="/receipts/new" kind="receipt">
                    Record a receipt
                  </NewDocumentLink>
                </Button>
              </>
            }
          >
            When an invoice, quotation or receipt is finished, choose “Save to history” on its page.
            It will appear here.
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y" data-testid="dashboard-recent">
          {recent.map((record) => (
            <li
              key={record.id}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/30"
              data-testid="dashboard-recent-item"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <KindBadge kind={record.kind} />
                  <span className="truncate text-sm font-semibold">
                    {record.summary.documentNumber}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {record.summary.customerName} · {formatDisplayDate(record.summary.date)}
                </p>
              </div>
              <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                {formatPaise(record.summary.totalPaise)}
              </p>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link
                  href={`/history?open=${encodeURIComponent(record.id)}`}
                  aria-label={`Open ${HISTORY_KIND_LABELS[record.kind]} ${record.summary.documentNumber}`}
                >
                  Open
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function GettingStarted({
  profileSaved,
  logoAdded,
  documentSaved,
  ready,
}: {
  profileSaved: boolean;
  logoAdded: boolean;
  documentSaved: boolean;
  ready: boolean;
}) {
  const steps = [
    {
      done: profileSaved,
      title: "Add your business details",
      hint: "Filled in automatically on new documents.",
      href: "/settings/business",
      action: profileSaved ? "Edit" : "Add",
    },
    {
      done: logoAdded,
      title: "Add a logo (optional)",
      hint: "Shown at the top of your invoices.",
      href: "/settings/business",
      action: logoAdded ? "Change" : "Add",
    },
    {
      done: documentSaved,
      title: "Save your first document",
      hint: "Finish an invoice and choose “Save to history”.",
      href: "/invoices/new",
      action: "Create",
      startsNew: true,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Panel
      id="getting-started-heading"
      title="Getting started"
      description={ready ? `${doneCount} of ${steps.length} done` : undefined}
    >
      <div
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={ready ? doneCount : 0}
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: ready ? `${(doneCount / steps.length) * 100}%` : "0%" }}
        />
      </div>
      <ol className="space-y-3.5">
        {steps.map((step) => (
          <li key={step.title} className="flex items-start gap-3">
            {ready && step.done ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <Circle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-muted-foreground/60"
              />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  ready && step.done && "text-muted-foreground line-through decoration-1",
                )}
              >
                {step.title}
                <span className="sr-only">
                  {ready && step.done ? " (done)" : " (not done yet)"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{step.hint}</p>
            </div>
            {"startsNew" in step ? (
              <NewDocumentLink
                kind="invoice"
                href={step.href}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
                aria-label={`${step.action}: ${step.title}`}
              >
                {step.action}
              </NewDocumentLink>
            ) : (
              <Link
                href={step.href}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
                aria-label={`${step.action}: ${step.title}`}
              >
                {step.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
