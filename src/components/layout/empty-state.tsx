import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

/** Friendly "nothing here yet" block with an icon, a short explanation and next steps. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground"
      >
        <Icon className="size-5.5" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {children ? (
        <div className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
