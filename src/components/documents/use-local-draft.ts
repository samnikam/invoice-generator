"use client";

import { useEffect, useRef, useState } from "react";

import {
  deleteDraft,
  getBrowserStorage,
  readDraft,
  writeDraft,
  type DraftKind,
  type DraftStorage,
} from "@/lib/drafts/draft-storage";

/** Wait this long after the last change before saving. */
const SAVE_DELAY_MS = 500;

export type DraftStatus =
  | { state: "checking" } // before the browser has been checked (first render)
  | { state: "unavailable" } // storage blocked or missing
  | { state: "off" }
  | { state: "saving" }
  | { state: "saved"; savedAt: string }
  | { state: "error"; reason: "quota" | "unavailable" | "error" | "delete" };

export type LocalDraft = {
  /** True while saving is turned on for this document type. */
  enabled: boolean;
  status: DraftStatus;
  /** Shown once when a stored draft could not be read and was not loaded. */
  notice: "unreadable" | null;
  enable: () => void;
  /** Asks for confirmation, then stops saving and deletes this document type's draft. */
  disableAndDelete: () => void;
};

/**
 * Optional, opt-in saving of a document form in this browser (see draft-storage.ts).
 *
 * - Nothing is read until after the first render, and nothing is written until the user
 *   turns saving on, so server and browser render the same HTML.
 * - When a valid draft exists it is restored once, after mount, through `restore`.
 * - Only the form values passed in are stored — never errors, focus or view state.
 */
export function useLocalDraft<T>({
  kind,
  values,
  parse,
  restore,
}: {
  kind: DraftKind;
  values: T;
  parse: (raw: unknown) => T | null;
  restore: (values: T) => void;
}): LocalDraft {
  const storageRef = useRef<DraftStorage | null>(null);
  const [checked, setChecked] = useState(false);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState<LocalDraft["notice"]>(null);
  /** JSON of the values most recently written, to tell "saved" from "saving". */
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [failure, setFailure] = useState<"quota" | "unavailable" | "error" | "delete" | null>(null);

  // Keep the latest callbacks without re-running the mount effect.
  const parseRef = useRef(parse);
  const restoreRef = useRef(restore);
  useEffect(() => {
    parseRef.current = parse;
    restoreRef.current = restore;
  });

  // After mount: check storage and restore an existing draft (browser only).
  useEffect(() => {
    const storage = getBrowserStorage();
    storageRef.current = storage;
    const result = readDraft(storage, kind, (raw) => parseRef.current(raw));
    /* eslint-disable react-hooks/set-state-in-effect -- one-time, client-only initialisation */
    setChecked(true);
    setAvailable(result.status !== "unavailable");
    if (result.status === "restored") {
      restoreRef.current(result.values);
      setEnabled(true);
      setSavedJson(JSON.stringify(result.values));
      setSavedAt(result.savedAt);
    } else if (result.status === "invalid") {
      setNotice("unreadable");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [kind]);

  const json = JSON.stringify(values);

  // While saving is on, write changes after a short pause in typing.
  useEffect(() => {
    if (!enabled || json === savedJson) return;
    const timer = window.setTimeout(() => {
      const result = writeDraft(storageRef.current, kind, JSON.parse(json));
      if (result.ok) {
        setSavedJson(json);
        setSavedAt(result.savedAt);
        setFailure(null);
      } else {
        setFailure(result.reason);
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, json, savedJson, kind]);

  function enable() {
    const storage = storageRef.current ?? getBrowserStorage();
    storageRef.current = storage;
    const result = writeDraft(storage, kind, values);
    if (result.ok) {
      setEnabled(true);
      setNotice(null);
      setSavedJson(json);
      setSavedAt(result.savedAt);
      setFailure(null);
    } else {
      setFailure(result.reason);
      if (result.reason === "unavailable") setAvailable(false);
    }
  }

  function disableAndDelete() {
    const confirmed = window.confirm(
      "Stop saving and delete the draft stored in this browser? The details on screen stay until you leave or refresh the page.",
    );
    if (!confirmed) return;
    if (!deleteDraft(storageRef.current, kind)) {
      // Not deleted: keep saving on (checkbox stays ticked) and say so, rather than
      // implying the draft is gone. The form on screen is left exactly as it is.
      setFailure("delete");
      return;
    }
    setEnabled(false);
    setSavedJson(null);
    setSavedAt(null);
    setFailure(null);
  }

  let status: DraftStatus;
  if (!checked) status = { state: "checking" };
  else if (!available) status = { state: "unavailable" };
  else if (failure) status = { state: "error", reason: failure };
  else if (!enabled) status = { state: "off" };
  else if (json !== savedJson || !savedAt) status = { state: "saving" };
  else status = { state: "saved", savedAt };

  return { enabled, status, notice, enable, disableAndDelete };
}

/**
 * Confirmation text for "Clear form". When draft saving is on, clearing also replaces
 * the browser draft with the empty form, so the user is told that explicitly.
 */
export function clearFormMessage(documentNoun: string, draftEnabled: boolean): string {
  const base = `Clear all ${documentNoun} details? This cannot be undone.`;
  return draftEnabled
    ? `${base} Draft saving is on, so the draft saved in this browser will also be replaced with the empty form.`
    : base;
}
