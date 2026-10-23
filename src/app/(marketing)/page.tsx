import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Check,
  Download,
  FilePlus2,
  Landmark,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { FeatureStatusBadge } from "@/components/feature-status-badge";
import { InvoicePreview } from "@/components/marketing/invoice-preview";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";

const benefits = [
  {
    icon: Landmark,
    title: "Built around Indian GST",
    description:
      "CGST + SGST for sales within your state, IGST for sales to other states, and a clear choice between a GST tax invoice and an invoice without GST.",
  },
  {
    icon: Calculator,
    title: "Calculations you can trust",
    description:
      "Amounts are calculated in whole paise, not floating-point numbers, with tested rounding — so totals never drift by a paisa.",
  },
  {
    icon: Smartphone,
    title: "Works on any device",
    description:
      "Designed for phones, tablets and desktops, so you can bill from the shop counter or the office.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    description:
      "No sign-up needed. What you enter stays in your browser tab and is never uploaded or saved.",
  },
] as const;

const steps = [
  {
    icon: FilePlus2,
    title: "Enter the details",
    description: "Add your business details, your customer and the invoice date.",
  },
  {
    icon: Calculator,
    title: "Add items",
    description: "Enter quantities, prices, discounts and GST rates. Taxes and totals update live.",
  },
  {
    icon: Download,
    title: "Download or print",
    description: "Check the preview, then download a PDF or print a clean copy.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-130 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent)]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
              <Sparkles aria-hidden="true" className="size-3.5 text-primary" />
              Early preview — tools are released step by step
            </p>
            <h1 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
              Professional invoices and business calculators,{" "}
              <span className="text-primary">made simple.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              Create GST invoices, quotations and payment receipts, and get quick answers on tax,
              discounts and margins — designed for Indian shops, freelancers, consultants and
              service providers.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/dashboard">
                  Open workspace
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-8 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Included
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {["No sign-up needed", "CGST, SGST & IGST", "Amount in words", "PDF & print"].map(
                (point) => (
                  <li key={point} className="flex items-center gap-2">
                    <Check aria-hidden="true" className="size-4 text-success" />
                    {point}
                  </li>
                ),
              )}
            </ul>
          </div>

          <InvoicePreview />
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Why SmartBill"
            title="Billing that respects how Indian businesses work"
            description="Focused on getting the numbers and the paperwork right, without the clutter."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div key={benefit.title}>
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <benefit.icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Features"
            title="Everything you need to bill a customer"
            description="Each tool is released only after its calculations and documents have been tested. Status is shown on every card."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.id}
                className="flex flex-col rounded-xl border bg-card p-6 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <feature.icon aria-hidden="true" className="size-5" />
                  </span>
                  <FeatureStatusBadge status={feature.status} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {feature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                {feature.status === "available" && feature.href ? (
                  <Button asChild variant="outline" className="mt-6 self-start">
                    <Link href={feature.href}>
                      Open {feature.shortTitle.toLowerCase()}
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="How it works" title="From details to document in three steps" />
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative rounded-xl border bg-background p-6">
                <span className="text-sm font-semibold text-primary">Step {index + 1}</span>
                <step.icon aria-hidden="true" className="mt-3 size-6 text-foreground" />
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call to action */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Follow SmartBill as it grows
              </h2>
              <p className="mt-2 max-w-xl text-primary-foreground/80">
                Open the workspace to see which tools are ready. New tools appear there as soon as
                they pass testing.
              </p>
            </div>
            <Button asChild size="xl" variant="secondary" className="shrink-0">
              <Link href="/dashboard">
                Open workspace
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{title}</h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
