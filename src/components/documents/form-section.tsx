import type { ReactNode } from "react";

/** id of a FormSection heading, e.g. for aria-labelledby on a radio group inside it. */
export function sectionHeadingId(title: string): string {
  return `section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

/** A titled card grouping related fields in a document form. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const id = sectionHeadingId(title);
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
