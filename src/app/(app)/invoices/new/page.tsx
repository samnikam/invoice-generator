import type { Metadata } from "next";

import { InvoiceGenerator } from "@/features/invoices/invoice-generator";

export const metadata: Metadata = {
  title: "New invoice",
  description:
    "Create a GST tax invoice or an invoice without GST, then print or save it as a PDF.",
};

export default function NewInvoicePage() {
  return <InvoiceGenerator />;
}
