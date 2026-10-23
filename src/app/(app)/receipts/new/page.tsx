import type { Metadata } from "next";

import { ReceiptGenerator } from "@/features/receipts/receipt-generator";

export const metadata: Metadata = {
  title: "New payment receipt",
  description: "Create a payment receipt with amount in words, then print or save it as a PDF.",
};

export default function NewReceiptPage() {
  return <ReceiptGenerator />;
}
