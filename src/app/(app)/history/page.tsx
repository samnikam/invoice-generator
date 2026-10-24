import type { Metadata } from "next";

import { HistoryBrowser } from "@/features/history/history-browser";

export const metadata: Metadata = {
  title: "Document history",
  description:
    "Find, open and reprint invoices, quotations and receipts saved to history in this browser.",
};

export default function HistoryPage() {
  return <HistoryBrowser />;
}
