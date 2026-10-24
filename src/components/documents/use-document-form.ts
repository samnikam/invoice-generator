"use client";

import { useRef, useState } from "react";

/**
 * Form state shared by the document generators (invoice, quotation, receipt):
 * - an error is shown for a field once the user has interacted with it, or for every
 *   field after a print attempt;
 * - printing (and saving to history) is refused, and the error summary focused, until the
 *   document is complete;
 * - the browser's print dialog suggests the page title as the PDF file name, so the
 *   title is set to e.g. "Invoice INV-001" while printing and restored afterwards.
 */
export function useDocumentForm(errors: Record<string, string>, ready: boolean) {
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  /** What the last blocked attempt was, for the error summary ("…before printing"). */
  const [blockedAction, setBlockedAction] = useState<BlockedAction>("printing");
  const summaryRef = useRef<HTMLDivElement>(null);

  const touch = (field: string) =>
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));

  const errorFor = (field: string): string | undefined =>
    showAllErrors || touched.has(field) ? errors[field] : undefined;

  /** True when the document is complete; otherwise shows every problem and returns false. */
  function requireReady(action: BlockedAction): boolean {
    if (ready) return true;
    setBlockedAction(action);
    setShowAllErrors(true);
    setView("edit");
    requestAnimationFrame(() => summaryRef.current?.focus());
    return false;
  }

  function print(fileTitle: string) {
    if (!requireReady("printing")) return;
    const previousTitle = document.title;
    document.title = fileTitle;
    window.print();
    document.title = previousTitle;
  }

  function resetInteraction() {
    setTouched(new Set());
    setShowAllErrors(false);
  }

  return {
    touch,
    errorFor,
    showSummary: showAllErrors && Object.keys(errors).length > 0,
    summaryAction: blockedAction,
    summaryRef,
    view,
    setView,
    print,
    requireReady,
    resetInteraction,
  };
}

export type BlockedAction = "printing" | "saving to history";
