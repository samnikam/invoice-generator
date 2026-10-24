"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";

import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import {
  findSameNumber,
  HISTORY_KIND_LABELS,
  summarize,
  type HistoryDocument,
} from "@/lib/history/history";
import { listHistory, saveToHistory } from "@/lib/history/history-storage";

type SaveStatus =
  | { state: "idle" }
  /** `values` is the exact form state that was saved, so the message hides after edits. */
  | { state: "saved"; savedAt: string; values: unknown }
  | { state: "error"; reason: "unavailable" | "quota" | "error" };

const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

/**
 * "Save to history" for a document generator. Saving is always an explicit action:
 * printing does not save, and saving never means the document was sent to anyone.
 *
 * `requireReady` is the generator's completeness check (the same one used for printing);
 * it shows the error summary when the document is not finished.
 */
export function useSaveToHistory(
  doc: HistoryDocument,
  requireReady: (action: "saving to history") => boolean,
) {
  const [status, setStatus] = useState<SaveStatus>({ state: "idle" });

  function save() {
    if (!requireReady("saving to history")) return;
    const summary = summarize(doc);
    if (!summary) return;
    const storage = getBrowserStorage();

    const existing = listHistory(storage);
    if (existing.status === "loaded") {
      const same = findSameNumber(existing.records, doc.kind, summary.documentNumber);
      const latest = same[0];
      if (latest) {
        const label = HISTORY_KIND_LABELS[doc.kind];
        const ok = window.confirm(
          `${label} ${summary.documentNumber} is already in your history (saved ${dateFormatter.format(new Date(latest.savedAt))}).\n\nSave another copy? The earlier record is kept unchanged.`,
        );
        if (!ok) return;
      }
    }

    const result = saveToHistory(storage, doc);
    if (result.ok) {
      setStatus({ state: "saved", savedAt: result.record.savedAt, values: doc.values });
    } else if (result.reason !== "incomplete") {
      setStatus({ state: "error", reason: result.reason });
    }
  }

  // A "saved" message belongs to the exact values that were saved; after any edit it hides.
  const visible: SaveStatus =
    status.state === "saved" && status.values !== doc.values ? { state: "idle" } : status;

  return { save, status: <HistorySaveStatus status={visible} /> };
}

function HistorySaveStatus({ status }: { status: SaveStatus }) {
  return (
    <div role="status" data-testid="history-save-status" className="print:hidden">
      {status.state === "saved" ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
          <span>
            Saved to history in this browser at {timeFormatter.format(new Date(status.savedAt))}. It
            is stored on this device only.
          </span>
          <Link
            href="/history"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            View history
          </Link>
        </p>
      ) : status.state === "error" ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {status.reason === "quota"
            ? "Could not save to history: this browser's storage is full. Delete old records in History, then try again. Your details are still on screen."
            : status.reason === "unavailable"
              ? "Could not save to history: this browser is blocking storage (for example in some private-browsing modes). Your details are still on screen."
              : "Could not save to history. Please try again. Your details are still on screen."}
        </p>
      ) : null}
    </div>
  );
}
