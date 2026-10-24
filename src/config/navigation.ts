import { Building2, History, LayoutDashboard } from "lucide-react";
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

/**
 * Sidebar navigation for the application workspace. Only pages that exist and work are
 * listed; a new module is added here only once it has been built and tested.
 */
export const appNav: AppNavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    label: "Sales",
    items: [featureNavItem("invoices"), featureNavItem("quotations"), featureNavItem("receipts")],
  },
  {
    label: "Records",
    items: [{ title: "History", icon: History, href: "/history" }],
  },
  { label: "Tools", items: [featureNavItem("calculators")] },
  {
    label: "Settings",
    items: [{ title: "Business profile", icon: Building2, href: "/settings/business" }],
  },
];

/** The navigation group and item for a path (used for the top bar title), if any. */
export function findNavLocation(
  pathname: string,
): { group: string | undefined; item: AppNavItem } | undefined {
  for (const group of appNav) {
    const item = group.items.find(
      (i) => i.href && (pathname === i.href || pathname.startsWith(`${i.href}/`)),
    );
    if (item) return { group: group.label, item };
  }
  return undefined;
}

export type CreateAction = {
  kind: "invoice" | "quotation" | "receipt";
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

/** Entries of the top bar's "New" menu: available document tools only (never dead links). */
export const createActions: CreateAction[] = (
  [
    ["invoices", "invoice", "New invoice", "Tax invoice or invoice without GST"],
    ["quotations", "quotation", "New quotation", "Price quote with validity date"],
    ["receipts", "receipt", "New receipt", "Record a payment received"],
  ] as const
).flatMap(([id, kind, label, description]) => {
  const feature = features.find((f) => f.id === id);
  return feature?.status === "available" && feature.href
    ? [{ kind, label, description, href: feature.href, icon: feature.icon }]
    : [];
});
