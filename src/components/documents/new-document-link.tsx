"use client";

import type { ComponentProps } from "react";
import Link from "next/link";

import { requestNewDocument } from "@/components/documents/new-document-request";
import type { DraftKind } from "@/lib/drafts/draft-storage";

/**
 * Link for "New …" / "Create …" actions. Besides navigating, it asks the document form
 * to start fresh (see new-document-request.ts). Use a plain Link for ordinary navigation,
 * which keeps an unfinished form as it is.
 */
export function NewDocumentLink({
  kind,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { kind: DraftKind }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        requestNewDocument(kind);
      }}
    />
  );
}
