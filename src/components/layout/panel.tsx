import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Card with a titled header bar, used for dashboard and list sections. (Document forms
 * use FormSection, which has the same look.)
 */
export function Panel({
  id,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  /** id of the heading, for aria-labelledby. */
  id: string;
  title: string;
  description?: ReactNode;
  /** Small link or button on the right of the header. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col rounded-xl border bg-card shadow-card", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h2
            id={id}
            className="flex items-center gap-2.5 text-[0.95rem] font-semibold tracking-tight"
          >
            <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-primary" />
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 pl-3.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
