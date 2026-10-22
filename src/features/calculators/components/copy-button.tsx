"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

/**
 * Copies `text` to the clipboard. The result is announced through a polite live region,
 * and a failure (e.g. clipboard permission blocked) is reported instead of ignored.
 */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard not available");
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="lg" onClick={copy}>
        {state === "copied" ? (
          <Check data-icon="inline-start" />
        ) : (
          <Copy data-icon="inline-start" />
        )}
        {state === "copied" ? "Copied" : label}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {state === "copied"
          ? "Copied to clipboard."
          : state === "failed"
            ? "Could not copy automatically. Select the text and copy it manually."
            : ""}
      </p>
    </div>
  );
}
