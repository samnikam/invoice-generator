"use client";

import Link from "next/link";
import { Building2, UserRoundCheck } from "lucide-react";

import type { SavedProfileState } from "@/components/profile/use-saved-profile";
import { Button } from "@/components/ui/button";

/**
 * Shown at the top of a document's "Your business" section. Explains when the business
 * details came from the saved profile, and lets the user re-apply the profile on demand.
 */
export function ProfileFillBar({
  saved,
  filledFromProfile,
  documentNoun,
  onUseProfile,
}: {
  saved: SavedProfileState;
  filledFromProfile: boolean;
  documentNoun: string;
  onUseProfile: () => void;
}) {
  if (saved.state === "checking") return null;

  return (
    <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm" data-testid="profile-fill-bar">
      {filledFromProfile ? (
        <p className="flex gap-2 text-muted-foreground" data-testid="filled-from-profile">
          <UserRoundCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          Filled from your saved business profile. Changes here apply to this {documentNoun} only.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {saved.state === "loaded" ? (
          <Button type="button" variant="outline" size="sm" onClick={onUseProfile}>
            <Building2 data-icon="inline-start" />
            Use saved business details
          </Button>
        ) : (
          <span className="text-muted-foreground">
            Save your business details once and they will be filled in for you.
          </span>
        )}
        <Link href="/settings/business" className="text-primary underline-offset-2 hover:underline">
          {saved.state === "loaded" ? "Edit business profile" : "Set up business profile"}
        </Link>
      </div>
    </div>
  );
}
