import { LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { features } from "@/config/features";

/** Links in the public website header. All point to sections on the landing page. */
export const marketingNav = [
  { title: "Features", href: "/#features" },
  { title: "Benefits", href: "/#benefits" },
  { title: "How it works", href: "/#how-it-works" },
] as const;

export type AppNavItem = {
  title: string;
  icon: LucideIcon;
  /** Present only when the page exists. Items without href render as "Soon". */
  href?: string;
};

export type AppNavGroup = {
  label?: string;
  items: AppNavItem[];
};

function featureNavItem(id: (typeof features)[number]["id"]): AppNavItem {
  const feature = features.find((f) => f.id === id);
  if (!feature) throw new Error(`Unknown feature: ${id}`);
  return {
    title: feature.shortTitle,
    icon: feature.icon,
    href: feature.status === "available" ? feature.href : undefined,
  };
}

/** Sidebar navigation for the application workspace. */
export const appNav: AppNavGroup[] = [
  { items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }] },
  {
    label: "Documents",
    items: [featureNavItem("invoices"), featureNavItem("quotations"), featureNavItem("receipts")],
  },
  { label: "Tools", items: [featureNavItem("calculators")] },
];
