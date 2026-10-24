import { cn } from "cn";

import { HISTORY_KIND_LABELS, type HistoryKind } from "@/lib/history/history";

const KIND_STYLES: Record<HistoryKind, string> = {
  invoice: "bg-primary/10 text-primary ring-primary/20",
  quotation: "bg-info/10 text-info ring-info/20",
  receipt: "bg-success/10 text-success ring-success/25",
};

/** Small coloured label for a saved document's type: Invoice, Quotation or Receipt. */
export function KindBadge({ kind, className }: { kind: HistoryKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        KIND_STYLES[kind],
        className,
      )}
    >
      {HISTORY_KIND_LABELS[kind]}
    </span>
  );
}
