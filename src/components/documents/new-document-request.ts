"use client";

import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";

import type { DraftKind } from "@/lib/drafts/draft-storage";

/**
 * "START A NEW DOCUMENT" REQUESTS
 * ═══════════════════════════════
 * With Cache Components, Next.js keeps visited pages alive (hidden with React <Activity>)
 * instead of unmounting them, so a document form keeps what was typed when the user
 * navigates away and back. That is right for ordinary navigation (no lost work), but an
 * explicit "New invoice" / "Create invoice" action must start a fresh form — also when the
 * user is already on that page, where following the link changes nothing by itself.
 *
 * New/Create links call requestNewDocument(kind) when clicked. The matching generator
 * handles the request as soon as it is (or becomes) visible. Requests are kept in memory
 * only: nothing is stored.
 */
const requests: Record<DraftKind, number> = { invoice: 0, quotation: 0, receipt: 0 };
const listeners = new Set<() => void>();

export function requestNewDocument(kind: DraftKind): void {
  requests[kind] += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Calls `onRequest` once for every new-document request made after this form first
 * appeared. A form that is mounted because of the request is already fresh, so the
 * request that led to it is not replayed.
 */
export function useNewDocumentRequest(kind: DraftKind, onRequest: () => void): void {
  const count = useSyncExternalStore(
    subscribe,
    () => requests[kind],
    () => 0,
  );
  const handled = useRef(count);
  const handle = useEffectEvent(onRequest);

  useEffect(() => {
    if (count === handled.current) return;
    handled.current = count;
    handle();
  }, [count]);
}
