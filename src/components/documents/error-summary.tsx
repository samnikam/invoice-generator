import type { Ref } from "react";
import { CircleAlert } from "lucide-react";

export type SummaryIssue = { field: string; label: string; message: string };

/**
 * List of problems shown when the user tries to print an incomplete document. Each item
 * links to its field and moves keyboard focus there.
 */
export function ErrorSummary({
  issues,
  domId,
  action = "printing",
  ref,
}: {
  issues: readonly SummaryIssue[];
  domId: (field: string) => string;
  /** What the problems block, e.g. "printing" or "saving". */
  action?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-destructive/30"
    >
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <CircleAlert aria-hidden="true" className="size-4" />
        Please fix {issues.length} {issues.length === 1 ? "problem" : "problems"} before {action}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {issues.map((issue) => (
          <li key={issue.field}>
            <a
              href={`#${domId(issue.field)}`}
              className="underline underline-offset-2 hover:text-destructive"
              onClick={(e) => {
                const target = document.getElementById(domId(issue.field));
                if (target) {
                  e.preventDefault();
                  target.focus();
                  target.scrollIntoView({ block: "center" });
                }
              }}
            >
              {issue.label}
            </a>
            : {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
