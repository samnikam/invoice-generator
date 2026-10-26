import { CheckCircle2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlaceOfSupplySuggestion } from "@/lib/documents/place-of-supply-suggestion";

/**
 * Note under "Place of supply" based on the customer's GSTIN. It never changes anything by
 * itself: the place of supply changes only if the user presses "Use … as place of supply".
 * Rendered inside a polite live region so screen readers hear when it appears.
 */
export function PlaceOfSupplyHint({
  suggestion,
  onUse,
  onDismiss,
}: {
  suggestion: PlaceOfSupplySuggestion | null;
  onUse: (stateCode: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div aria-live="polite" className="print:hidden">
      {suggestion?.kind === "matches" ? (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="pos-suggestion-match"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
          Matches the state in the customer’s GSTIN: {suggestion.state.name} (
          {suggestion.state.code}).
        </p>
      ) : suggestion?.kind === "suggest" ? (
        <div
          className="space-y-2.5 rounded-lg border border-info/25 bg-info/5 p-3 text-sm"
          data-testid="pos-suggestion"
        >
          <p className="flex items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
            <span>
              The customer’s GSTIN is registered in{" "}
              <strong className="font-semibold">
                {suggestion.state.name} ({suggestion.state.code})
              </strong>
              {suggestion.placeOfSupplyChosen
                ? ", but a different place of supply is selected."
                : "."}{" "}
              <span className="text-muted-foreground">
                This is often the place of supply, but it depends on the transaction — please check
                before using it.
              </span>
            </span>
          </p>
          <div className="flex flex-wrap gap-2 pl-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onUse(suggestion.state.code)}
            >
              Use {suggestion.state.name} ({suggestion.state.code}) as place of supply
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
