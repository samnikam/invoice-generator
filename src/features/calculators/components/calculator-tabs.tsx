"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { calculators } from "@/config/calculators";

/** Quick switching between calculators. Scrolls sideways on narrow screens. */
export function CalculatorTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Calculators" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-lg border bg-card p-1 shadow-card">
        {calculators.map((calculator) => {
          const active = pathname === calculator.href;
          return (
            <li key={calculator.slug}>
              <Link
                href={calculator.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
                )}
              >
                <calculator.icon aria-hidden="true" className="size-4" />
                {calculator.shortTitle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
