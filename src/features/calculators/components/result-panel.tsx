import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Results area. aria-live="polite" makes screen readers announce new results
 * after the user stops typing, without interrupting them.
 */
export function ResultPanel({
  title = "Result",
  ready,
  emptyMessage = "Results appear here once all required fields are filled in correctly.",
  formError,
  children,
}: {
  title?: string;
  ready: boolean;
  emptyMessage?: string;
  formError?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="result-heading"
      className="rounded-xl border bg-card shadow-card lg:sticky lg:top-24"
    >
      <h2
        id="result-heading"
        className="flex items-center gap-2.5 border-b px-5 py-3.5 text-[0.95rem] font-semibold tracking-tight sm:px-6"
      >
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-primary" />
        {title}
      </h2>
      <div aria-live="polite" className="p-5 sm:p-6">
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : ready ? (
          children
        ) : (
          <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

export function ResultList({ children }: { children: ReactNode }) {
  return <dl className="divide-y">{children}</dl>;
}

export function ResultRow({
  label,
  value,
  emphasis = false,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2.5",
        emphasis && "mt-1 border-t-2 border-primary/15 pt-3",
      )}
    >
      <dt className={cn("text-sm", emphasis ? "font-semibold" : "text-muted-foreground")}>
        {label}
      </dt>
      <dd
        data-testid={testId}
        className={cn(
          "text-right tabular-nums",
          emphasis ? "text-lg font-semibold text-primary" : "text-sm font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Small explanatory box under a calculator ("How this is calculated"). */
export function Explanation({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground sm:p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
