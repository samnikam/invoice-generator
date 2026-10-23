import type { Metadata } from "next";

import { BillingDocumentGenerator } from "@/features/billing-documents/document-generator";

export const metadata: Metadata = {
  title: "New invoice",
  description:
    "Create a GST tax invoice or an invoice without GST, then print or save it as a PDF.",
};

export default function NewInvoicePage() {
  return <BillingDocumentGenerator kind="invoice" />;
}
