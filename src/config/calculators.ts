import { CaseSensitive, Percent, Tag, TrendingUp, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** The business calculators, in display order. Used by the index page and calculator tabs. */
export type CalculatorInfo = {
  slug: "gst" | "reverse-gst" | "discount" | "margin" | "amount-in-words";
  href: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
};

export const calculators: readonly CalculatorInfo[] = [
  {
    slug: "gst",
    href: "/calculators/gst",
    title: "GST calculator",
    shortTitle: "GST",
    description: "Add GST to an amount and see CGST, SGST/UTGST or IGST.",
    icon: Percent,
  },
  {
    slug: "reverse-gst",
    href: "/calculators/reverse-gst",
    title: "Reverse GST calculator",
    shortTitle: "Reverse GST",
    description: "Find the amount before GST from a price that already includes GST.",
    icon: Undo2,
  },
  {
    slug: "discount",
    href: "/calculators/discount",
    title: "Discount calculator",
    shortTitle: "Discount",
    description: "Work out a percentage or fixed-amount discount and the final price.",
    icon: Tag,
  },
  {
    slug: "margin",
    href: "/calculators/margin",
    title: "Profit margin & markup",
    shortTitle: "Margin & markup",
    description: "See profit, margin and markup from your cost and selling price.",
    icon: TrendingUp,
  },
  {
    slug: "amount-in-words",
    href: "/calculators/amount-in-words",
    title: "Amount in words",
    shortTitle: "Amount in words",
    description: "Write a rupee amount in words, using lakh and crore, for cheques and invoices.",
    icon: CaseSensitive,
  },
];

export function getCalculator(slug: CalculatorInfo["slug"]): CalculatorInfo {
  const calculator = calculators.find((c) => c.slug === slug);
  if (!calculator) throw new Error(`Unknown calculator: ${slug}`);
  return calculator;
}
