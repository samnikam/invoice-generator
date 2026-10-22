import { Sparkles } from "lucide-react";

export function PreviewNotice() {
  return (
    <div className="rounded-lg bg-muted/70 p-3 text-xs leading-relaxed text-muted-foreground">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Sparkles aria-hidden="true" className="size-3.5 text-primary" />
        Early preview
      </p>
      <p className="mt-1">Tools marked “Soon” are being built and tested.</p>
    </div>
  );
}
