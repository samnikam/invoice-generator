import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCalculator, type CalculatorInfo } from "@/config/calculators";

import { CalculatorTabs } from "./calculator-tabs";

/** Page frame shared by every calculator: back link, title, tabs, then the calculator. */
export function CalculatorLayout({
  slug,
  children,
}: {
  slug: CalculatorInfo["slug"];
  children: ReactNode;
}) {
  const calculator = getCalculator(slug);
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/calculators"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All calculators
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {calculator.title}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{calculator.description}</p>
      </div>
      <CalculatorTabs />
      {children}
    </div>
  );
}

/** Two-column grid on large screens: form on the left, results on the right. */
export function CalculatorGrid({ form, result }: { form: ReactNode; result: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">{form}</div>
      {result}
    </div>
  );
}
