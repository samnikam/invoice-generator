"use client";

import { useRef, useState } from "react";

/**
 * Form state shared by the document generators (invoice, quotation, receipt):
 * - an error is shown for a field once the user has interacted with it, or for every
 *   field after a print attempt;
 * - printing is refused (and the error summary focused) until the document is complete;
 * - the browser's print dialog suggests the page title as the PDF file name, so the
 *   title is set to e.g. "Invoice INV-001" while printing and restored afterwards.
 */
export function useDocumentForm(errors: Record<string, string>, ready: boolean) {
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const summaryRef = useRef<HTMLDivElement>(null);

  const touch = (field: string) =>
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));

  const errorFor = (field: string): string | undefined =>
    showAllErrors || touched.has(field) ? errors[field] : undefined;

  function print(fileTitle: string) {
    if (!ready) {
      setShowAllErrors(true);
      setView("edit");
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
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
    summaryRef,
    view,
    setView,
    print,
    resetInteraction,
  };
}
