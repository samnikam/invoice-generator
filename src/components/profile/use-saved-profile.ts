"use client";

import { useCallback, useEffect, useState } from "react";

import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import type { BusinessProfile } from "@/lib/profile/business-profile";
import { readProfile } from "@/lib/profile/profile-storage";

export type SavedProfileState =
  | { state: "checking" } // first render, before the browser is read
  | { state: "none" }
  | { state: "loaded"; profile: BusinessProfile; savedAt: string }
  | { state: "invalid" }
  | { state: "unavailable" };

/**
 * Reads the saved business profile in the browser after the page loads (never during
 * server rendering, so there is no hydration mismatch). Read-only: it never writes.
 */
export function useSavedProfile(): SavedProfileState & { refresh: () => void } {
  const [saved, setSaved] = useState<SavedProfileState>({ state: "checking" });

  const refresh = useCallback(() => {
    const result = readProfile(getBrowserStorage());
    setSaved(
      result.status === "loaded"
        ? { state: "loaded", profile: result.profile, savedAt: result.savedAt }
        : { state: result.status },
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time, client-only read
    refresh();
  }, [refresh]);

  return { ...saved, refresh };
}
