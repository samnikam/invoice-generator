"use client";

import type { ReactNode } from "react";
import { Eraser, Info, Printer } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

/**
 * Page frame shared by the document generators: title, Clear / Print actions, privacy
 * note, and the form + live preview. Below 1536px wide, an "Edit details / Preview"
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
  form: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="space-y-6" data-wide-page>
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={onClear}>
            <Eraser data-icon="inline-start" />
            Clear form
          </Button>
          <Button type="button" size="lg" onClick={onPrint}>
            <Printer data-icon="inline-start" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <p className="flex gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground print:hidden">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Details stay in this browser tab only. Nothing is saved or uploaded, and refreshing the page
        clears the form. To save a PDF, choose “Save as PDF” in the print window.
      </p>

      <div
        role="group"
        aria-label="Show"
        className="inline-flex rounded-lg bg-muted p-1 2xl:hidden print:hidden"
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
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
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
