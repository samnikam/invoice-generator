import { ShieldCheck } from "lucide-react";

/** Short privacy reminder at the foot of the navigation. */
export function PreviewNotice() {
  return (
    <div className="flex gap-2 px-1 text-[0.72rem] leading-relaxed text-muted-foreground">
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-sidebar-primary" />
      <p>
        <span className="font-medium text-sidebar-foreground">Early preview.</span> Nothing is
        uploaded. Details are saved only if you choose, and only in this browser.
      </p>
    </div>
  );
}
