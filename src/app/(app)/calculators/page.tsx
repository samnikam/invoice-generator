import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { calculators } from "@/config/calculators";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Business calculators",
  description: "GST, reverse GST, discount, margin and markup, and amount-in-words calculators.",
};

export default function CalculatorsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tools"
        title="Business calculators"
        description="Quick, explained answers for everyday pricing and tax questions. Nothing you enter here is saved or sent anywhere."
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {calculators.map((calculator) => (
          <li key={calculator.slug}>
            <Link
              href={calculator.href}
              className="group flex h-full flex-col rounded-xl border bg-card p-5 shadow-card transition-[box-shadow,border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/75 text-primary-foreground shadow-sm shadow-primary/30">
                <calculator.icon aria-hidden="true" className="size-5" />
              </span>
              <span className="mt-4 font-semibold">{calculator.title}</span>
              <span className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                {calculator.description}
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
