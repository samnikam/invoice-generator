import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

const TONES = {
  primary: "bg-primary/10 text-primary ring-primary/15",
  info: "bg-info/10 text-info ring-info/20",
  success: "bg-success/10 text-success ring-success/20",
  neutral: "bg-muted text-muted-foreground ring-border",
} as const;

/** A single summary figure (e.g. "Invoices this month") with an optional supporting line. */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
  testId,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  testId?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          aria-hidden="true"
          className={cn("flex size-9 items-center justify-center rounded-lg ring-1", TONES[tone])}
        >
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums" data-stat-value>
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
