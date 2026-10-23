import type { Metadata } from "next";

import { BillingDocumentGenerator } from "@/features/billing-documents/document-generator";

export const metadata: Metadata = {
  title: "New quotation",
  description:
    "Create a quotation or estimate with or without GST, then print or save it as a PDF.",
};

export default function NewQuotationPage() {
  return <BillingDocumentGenerator kind="quotation" />;
}
