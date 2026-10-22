import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { calculators } from "@/config/calculators";

export const metadata: Metadata = {
  title: "Business calculators",
  description: "GST, reverse GST, discount, margin and markup, and amount-in-words calculators.",
};

export default function CalculatorsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Business calculators</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Quick, explained answers for everyday pricing and tax questions. Nothing you enter here is
          saved or sent anywhere.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {calculators.map((calculator) => (
          <li key={calculator.slug}>
            <Link
              href={calculator.href}
              className="group flex h-full flex-col rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
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
