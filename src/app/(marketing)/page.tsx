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

/** Icon tile colours, so each card is easy to tell apart at a glance. */
const tones = [
  "bg-primary/10 text-primary ring-primary/15",
  "bg-success/10 text-success ring-success/20",
  "bg-info/10 text-info ring-info/20",
  "bg-warning/20 text-warning-foreground ring-warning/30",
] as const;

const tone = (index: number) => tones[index % tones.length];

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
      "No sign-up needed and nothing is uploaded. Details are kept only if you choose to save them, and then only in your own browser.",
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

const cardHover =
  "transition-[box-shadow,border-color,translate] duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b bg-card">
        {/* Background: a faint grid that fades out, plus soft colour glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(70%_60%_at_50%_0%,black,transparent)] bg-size-[44px_44px] opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-24 -z-10 size-112 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-40 -right-24 -z-10 size-104 rounded-full bg-info/15 blur-3xl"
        />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-accent/70 px-3 py-1 text-xs font-medium text-accent-foreground shadow-xs">
              <Sparkles aria-hidden="true" className="size-3.5" />
              Early preview — tools are released step by step
            </p>
            <h1 className="mt-6 text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
              Professional invoices and business calculators,{" "}
              <span className="bg-linear-to-r from-primary to-info bg-clip-text text-transparent">
                made simple.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              Create GST invoices, quotations and payment receipts, and get quick answers on tax,
              discounts and margins — designed for Indian shops, freelancers, consultants and
              service providers.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl" className="shadow-lg shadow-primary/25">
                <Link href="/dashboard">
                  Open workspace
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-10 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Included
            </p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {["No sign-up needed", "CGST, SGST & IGST", "Amount in words", "PDF & print"].map(
                (point) => (
                  <li
                    key={point}
                    className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 font-medium text-foreground/80 shadow-xs"
                  >
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
      <section id="benefits" className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading
            eyebrow="Why SmartBill"
            title="Billing that respects how Indian businesses work"
            description="Focused on getting the numbers and the paperwork right, without the clutter."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className={`rounded-2xl border bg-card p-6 shadow-card ${cardHover}`}
              >
                <span
                  className={`flex size-12 items-center justify-center rounded-xl ring-1 ${tone(index)}`}
                >
                  <benefit.icon aria-hidden="true" className="size-6" />
                </span>
                <h3 className="mt-5 font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading
            eyebrow="Features"
            title="Everything you need to bill a customer"
            description="Each tool is released only after its calculations and documents have been tested. Status is shown on every card."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {features.map((feature, index) => (
              <article
                key={feature.id}
                className="flex flex-col rounded-2xl border bg-linear-to-b from-accent/50 to-card to-40% p-7 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex size-12 items-center justify-center rounded-xl ring-1 ${tone(index)}`}
                  >
                    <feature.icon aria-hidden="true" className="size-6" />
                  </span>
                  <FeatureStatusBadge status={feature.status} />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {feature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15"
                      >
                        <Check className="size-3 text-success" />
                      </span>
                      {highlight}
                    </li>
                  ))}
                </ul>
                {feature.status === "available" && feature.href ? (
                  <Button asChild variant="outline" className="mt-7 self-start">
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
      <section id="how-it-works" className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading eyebrow="How it works" title="From details to document in three steps" />
          <div className="relative mt-14">
            {/* Line joining the three step icons (wider screens) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-7 right-[16.67%] left-[16.67%] hidden h-0.5 bg-linear-to-r from-primary/30 via-info/40 to-primary/30 md:block"
            />
            <ol className="relative grid gap-6 md:grid-cols-3 md:gap-8">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex flex-col items-center rounded-2xl border bg-card p-6 text-center shadow-card md:border-0 md:bg-transparent md:p-0 md:shadow-none"
                >
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-deep text-primary-foreground shadow-lg ring-8 shadow-primary/25 ring-background">
                    <step.icon aria-hidden="true" className="size-6" />
                  </span>
                  <span className="mt-5 text-sm font-semibold text-primary">Step {index + 1}</span>
                  <h3 className="mt-1.5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="relative isolate flex flex-col items-start gap-6 overflow-hidden rounded-3xl bg-linear-to-br from-primary to-primary-deep px-6 py-12 text-primary-foreground shadow-2xl shadow-primary/25 sm:px-12 md:flex-row md:items-center md:justify-between">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 size-72 rounded-full bg-info/30 blur-3xl"
            />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Follow SmartBill as it grows
              </h2>
              <p className="mt-3 max-w-xl text-primary-foreground/85">
                Open the workspace to see which tools are ready. New tools appear there as soon as
                they pass testing.
              </p>
            </div>
            <Button
              asChild
              size="xl"
              variant="secondary"
              className="shrink-0 bg-card text-primary shadow-lg hover:bg-card/90"
            >
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
    <div className="mx-auto max-w-2xl text-center">
      <p className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
