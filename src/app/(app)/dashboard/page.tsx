import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HardDrive, Info } from "lucide-react";

import { FeatureStatusBadge } from "@/components/feature-status-badge";
import { ProfilePrompt } from "@/components/profile/profile-prompt";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  const inDevelopmentCount = features.filter((f) => f.status === "in-development").length;

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-primary-deep p-6 text-primary-foreground shadow-card-hover sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl"
        />
        <h1 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome to {siteConfig.name}
        </h1>
        <p className="relative mt-2 max-w-2xl text-primary-foreground/85">
          Your workspace for invoices, quotations, receipts and business calculators.
        </p>
      </div>

      {inDevelopmentCount > 0 ? (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-primary/20 bg-accent/60 p-4 text-sm sm:p-5"
        >
          <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">
              {inDevelopmentCount === 1
                ? "1 tool is still being built"
                : `${inDevelopmentCount} tools are still being built`}
            </p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {siteConfig.name} is in early preview. Tools marked “In development” will become
              available here once their calculations and documents have been tested.
            </p>
          </div>
        </div>
      ) : null}

      <ProfilePrompt />

      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="text-lg font-semibold tracking-tight">
          Your tools
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <li
              key={feature.id}
              className="flex flex-col rounded-xl border bg-card p-5 shadow-card transition-[box-shadow,border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/75 text-primary-foreground shadow-sm shadow-primary/30">
                  <feature.icon aria-hidden="true" className="size-5" />
                </span>
                <FeatureStatusBadge status={feature.status} />
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
              {feature.status === "available" && feature.href ? (
                <Button asChild className="mt-5 self-start">
                  <Link href={feature.href}>
                    Open
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="data-heading"
        className="flex gap-3 rounded-xl border bg-card p-5 text-sm shadow-card"
      >
        <HardDrive aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <h2 id="data-heading" className="font-semibold">
            About your data
          </h2>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            No account is needed and nothing is ever uploaded. Details are kept only if you choose
            to save a draft or your business profile — and then only in this browser on this device,
            not encrypted. Print or save a PDF to keep a copy of a document.
          </p>
        </div>
      </section>
    </div>
  );
}
