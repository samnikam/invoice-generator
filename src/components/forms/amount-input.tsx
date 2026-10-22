import type { ComponentProps } from "react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";

/**
 * Text input for money or percentages with a visible unit (₹ before, % after).
 * Uses inputMode="decimal" (numeric keyboard on phones) instead of type="number",
 * which silently accepts values like "1e5" and changes values on mouse-wheel scroll.
 */
export function AmountInput({
  unit,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { unit: "₹" | "%" }) {
  const before = unit === "₹";
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-muted-foreground",
          before ? "left-3" : "right-3",
        )}
      >
        {unit}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        className={cn("h-10 tabular-nums", before ? "pl-7" : "pr-8", className)}
        {...props}
      />
    </div>
  );
}
