import type { ReactNode } from "react";

/** id of a FormSection heading, e.g. for aria-labelledby on a radio group inside it. */
export function sectionHeadingId(title: string): string {
  return `section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

/** A titled card grouping related fields in a document form. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const id = sectionHeadingId(title);
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card shadow-card">
      <h2
        id={id}
        className="flex items-center gap-2.5 border-b px-5 py-3.5 text-[0.95rem] font-semibold tracking-tight"
      >
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-primary" />
        {title}
      </h2>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}
