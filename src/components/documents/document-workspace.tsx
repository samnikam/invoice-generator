"use client";

import type { ReactNode } from "react";
import { Archive, Eraser, Info, Printer } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

/**
 * Page frame shared by the document generators: title, Clear / Save to history / Print
 * actions, the
 * draft-saving panel, and the form + live preview. Below 1536px wide, an "Edit details / Preview"
 * switch shows one at a time; wider screens show both side by side.
 *
 * Printing: everything except the preview is hidden (print:hidden), and the preview is
 * always printed even if the "Edit details" view is showing on screen.
 */
export function DocumentWorkspace({
  title,
  description,
  documentNoun,
  view,
  onViewChange,
  onClear,
  onPrint,
  onSaveToHistory,
  historyStatus,
  draftPanel,
  form,
  preview,
}: {
  title: string;
  description: string;
  /** e.g. "invoice" — used in "Preview invoice". */
  documentNoun: string;
  view: "edit" | "preview";
  onViewChange: (view: "edit" | "preview") => void;
  onClear: () => void;
  onPrint: () => void;
  /** Saves a snapshot of the finished document to the browser-local history. */
  onSaveToHistory: () => void;
  /** Result of the last "Save to history" (see useSaveToHistory). */
  historyStatus: ReactNode;
  /** Draft-saving control (see DraftPanel). */
  draftPanel: ReactNode;
  form: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="space-y-6" data-wide-page>
      <PageHeader
        eyebrow="Sales"
        title={title}
        description={description}
        actions={
          <>
            <Button type="button" variant="ghost" size="lg" onClick={onClear}>
              <Eraser data-icon="inline-start" />
              Clear form
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={onSaveToHistory}>
              <Archive data-icon="inline-start" />
              Save to history
            </Button>
            <Button type="button" size="lg" onClick={onPrint}>
              <Printer data-icon="inline-start" />
              Print / Save as PDF
            </Button>
          </>
        }
      />

      {historyStatus}

      {draftPanel}

      <p className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
        <Info aria-hidden="true" className="size-4 shrink-0 text-primary/70" />
        To save a PDF, choose “Save as PDF” in the print window.
      </p>

      <div
        role="group"
        aria-label="Show"
        className="inline-flex rounded-lg border bg-card p-1 shadow-card 2xl:hidden print:hidden"
      >
        {(["edit", "preview"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => onViewChange(option)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              view === option
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
            )}
          >
            {option === "edit" ? "Edit details" : `Preview ${documentNoun}`}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:block">
        <div
          className={cn(
            "max-w-3xl min-w-0 2xl:max-w-none print:hidden",
            view === "preview" && "hidden 2xl:block",
          )}
        >
          {form}
        </div>
        <div
          className={cn(
            "min-w-0 2xl:sticky 2xl:top-20 print:static print:block",
            view === "edit" && "hidden 2xl:block",
          )}
        >
          {preview}
        </div>
      </div>
    </div>
  );
}
