import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { featureStatusLabel, type FeatureStatus } from "@/config/features";

/** Shows whether a tool can be used yet. Used on the landing page and dashboard. */
export function FeatureStatusBadge({
  status,
  className,
}: {
  status: FeatureStatus;
  className?: string;
}) {
  const available = status === "available";
  return (
    <Badge
      variant="outline"
      className={cn(
        available
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {available ? <CheckCircle2 data-icon="inline-start" /> : <Clock data-icon="inline-start" />}
      {featureStatusLabel[status]}
    </Badge>
  );
}
