"use client";

import { CircleAlert, HardDrive, Info } from "lucide-react";
import { cn } from "cn";

import type { DraftStatus, LocalDraft } from "@/components/documents/use-local-draft";

const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

function statusText(status: DraftStatus): string {
  switch (status.state) {
    case "checking":
    case "off":
      return "";
    case "saving":
      return "Saving…";
    case "saved":
      return `Saved in this browser at ${timeFormatter.format(new Date(status.savedAt))}`;
    case "unavailable":
      return "Draft saving is not available because this browser is blocking storage (for example in some private-browsing modes). Your details stay on screen until you refresh.";
    case "error":
      return status.reason === "quota"
        ? "Could not save: this browser's storage is full. Free up space, or turn off draft saving. Your details are still on screen."
        : status.reason === "unavailable"
          ? "Could not save: this browser is blocking storage. Your details are still on screen."
          : "Could not save the draft. Your details are still on screen.";
  }
}

/**
 * Opt-in control for saving a draft in this browser, with an honest explanation of
 * where the data goes. Hidden when printing.
 */
export function DraftPanel({ draft, documentNoun }: { draft: LocalDraft; documentNoun: string }) {
  const { enabled, status, notice } = draft;
  const disabled = status.state === "checking" || status.state === "unavailable";
  const message = statusText(status);
  const isProblem = status.state === "error" || status.state === "unavailable";

  return (
    <section
      aria-label="Draft saving"
      className="space-y-3 rounded-lg border bg-card p-4 text-sm print:hidden"
    >
      <div className="flex items-start gap-3">
        <input
          id="draft-toggle"
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          aria-describedby="draft-explanation draft-status"
          onChange={(e) => (e.target.checked ? draft.enable() : draft.disableAndDelete())}
          className="mt-0.5 size-4 shrink-0 accent-primary disabled:opacity-50"
        />
        <div className="space-y-1">
          <label htmlFor="draft-toggle" className="flex items-center gap-1.5 font-medium">
            <HardDrive aria-hidden="true" className="size-4 text-muted-foreground" />
            Save draft in this browser
          </label>
          <p id="draft-explanation" className="leading-relaxed text-muted-foreground">
            {status.state === "unavailable"
              ? "Details stay in this tab only and are cleared when you refresh."
              : enabled
                ? `This ${documentNoun} is being saved in this browser on this device only. It is not uploaded and not encrypted, and anyone who uses this browser can see it. Untick to stop saving and delete the draft.`
                : `Off: details stay in this tab only and are cleared when you refresh. Turn on to keep a draft of this ${documentNoun} in this browser on this device. It is not uploaded and not encrypted, and anyone who uses this browser can see it.`}
          </p>
          <p
            id="draft-status"
            role="status"
            data-testid="draft-status"
            className={cn(
              "flex items-start gap-1.5",
              isProblem ? "text-destructive" : "text-muted-foreground",
              !message && "sr-only",
            )}
          >
            {isProblem ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : null}
            {message}
          </p>
        </div>
      </div>
      {notice === "unreadable" ? (
        <p
          data-testid="draft-notice"
          className="flex gap-2 rounded-md bg-muted/60 p-3 text-muted-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />A draft saved earlier in
          this browser could not be read (it may be damaged or from an older version), so it was not
          loaded. Turning on saving will replace it.
        </p>
      ) : null}
    </section>
  );
}
