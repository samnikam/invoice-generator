"use client";

import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

import { useSavedProfile } from "@/components/profile/use-saved-profile";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * The business this workspace belongs to (from the Business Profile saved in this
 * browser), shown at the foot of the navigation. Read-only: it never writes anything.
 */
export function BusinessBadge({ onNavigate }: { onNavigate?: () => void }) {
  const saved = useSavedProfile();

  if (saved.state === "checking") {
    return <div aria-hidden="true" className="h-14 rounded-lg bg-sidebar-accent/50" />;
  }

  const name = saved.state === "loaded" ? saved.profile.name : null;
  const logo = saved.state === "loaded" ? saved.logo : null;

  return (
    <Link
      href="/settings/business"
      onClick={onNavigate}
      aria-label={name ? `Business: ${name}` : "Add your business details"}
      className="group/biz flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5 transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      data-testid="business-badge"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL, no optimisation needed
          <img src={logo} alt="" className="size-full bg-white object-contain p-0.5" />
        ) : name ? (
          initials(name)
        ) : (
          <Building2 className="size-4" />
        )}
      </span>
      <span aria-hidden="true" className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold text-sidebar-foreground">
          {name ?? "Your business"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {name ? "Saved in this browser" : "Add business details"}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/biz:translate-x-0.5"
      />
    </Link>
  );
}
