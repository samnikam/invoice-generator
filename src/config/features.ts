import { Calculator, FileText, MessageSquareQuote, ReceiptIndianRupee } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Single source of truth for SmartBill's tools and their release status.
 *
 * The landing page, dashboard and sidebar all read from this list. When a tool is
 * finished and tested, set `status: "available"` and add its `href` — every page
 * then updates together, so nothing is ever shown as working before it is.
 */
export type FeatureStatus = "available" | "in-development";

export type Feature = {
  id: "invoices" | "quotations" | "receipts" | "calculators";
  title: string;
  shortTitle: string;
  description: string;
  highlights: readonly string[];
  icon: LucideIcon;
  status: FeatureStatus;
  /** Route of the tool. Only set when status is "available". */
  href?: string;
};

export const features: readonly Feature[] = [
  {
    id: "invoices",
    title: "GST invoices",
    shortTitle: "Invoices",
    description:
      "Create tax invoices, bills of supply or simple invoices with automatic tax and totals.",
    highlights: [
      "CGST + SGST or IGST based on place of supply",
      "Per-item discounts and GST rates",
      "Live preview, PDF download and print",
    ],
    icon: FileText,
    status: "in-development",
  },
  {
    id: "quotations",
    title: "Quotations & estimates",
    shortTitle: "Quotations",
    description: "Send clear price quotes with taxes, validity date and your terms.",
    highlights: [
      "Same accurate tax engine as invoices",
      "Validity date and terms",
      "PDF and print",
    ],
    icon: MessageSquareQuote,
    status: "in-development",
  },
  {
    id: "receipts",
    title: "Payment receipts",
    shortTitle: "Receipts",
    description: "Record money received with payment method, reference and amount in words.",
    highlights: [
      "Cash, UPI, bank transfer and cheque",
      "Amount in Indian Rupee words",
      "PDF and print",
    ],
    icon: ReceiptIndianRupee,
    status: "in-development",
  },
  {
    id: "calculators",
    title: "Business calculators",
    shortTitle: "Calculators",
    description: "Quick, explained answers for everyday pricing and tax questions.",
    highlights: [
      "GST and reverse GST",
      "Discount, margin and markup",
      "Amount to words (Indian numbering)",
    ],
    icon: Calculator,
    status: "in-development",
  },
];

export const featureStatusLabel: Record<FeatureStatus, string> = {
  available: "Available",
  "in-development": "In development",
};
