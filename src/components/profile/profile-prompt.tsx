"use client";

import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { useSavedProfile } from "@/components/profile/use-saved-profile";
import { Button } from "@/components/ui/button";

/**
 * Dashboard prompt shown only when no business profile is saved in this browser.
 * Checked after page load, so nothing is shown during server rendering.
 */
export function ProfilePrompt() {
  const saved = useSavedProfile();
  if (saved.state !== "none" && saved.state !== "invalid") return null;

  return (
    <section
      aria-labelledby="profile-prompt-heading"
      data-testid="profile-prompt"
      className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-card p-5 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Building2 aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 id="profile-prompt-heading" className="font-semibold">
            Set up your business profile
          </h2>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Save your business details once and they will be filled in on new invoices, quotations
            and receipts.
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0 self-start sm:self-center">
        <Link href="/settings/business">
          Set up profile
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </section>
  );
}
