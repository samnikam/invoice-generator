import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FilePlus2, HardDrive, Info, ReceiptIndianRupee } from "lucide-react";

import { NewDocumentLink } from "@/components/documents/new-document-link";
import { FeatureStatusBadge } from "@/components/feature-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ProfilePrompt } from "@/components/profile/profile-prompt";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site";
import { BusinessGreeting, DashboardOverview } from "@/features/dashboard/dashboard-overview";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  const inDevelopmentCount = features.filter((f) => f.status === "in-development").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome to ${siteConfig.name}`}
        description={<BusinessGreeting />}
        actions={
          <>
            <Button asChild size="lg" variant="outline">
              <NewDocumentLink href="/receipts/new" kind="receipt">
                <ReceiptIndianRupee data-icon="inline-start" />
                Record receipt
              </NewDocumentLink>
            </Button>
            <Button asChild size="lg">
              <NewDocumentLink href="/invoices/new" kind="invoice">
                <FilePlus2 data-icon="inline-start" />
                Create invoice
              </NewDocumentLink>
            </Button>
          </>
        }
      />

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

      <DashboardOverview />

      <section aria-labelledby="tools-heading" className="space-y-4">
        <div>
          <h2 id="tools-heading" className="text-lg font-semibold tracking-tight">
            Your tools
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything below works today, with nothing to install.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <li
              key={feature.id}
              className="group flex flex-col rounded-xl border bg-card p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-card-hover motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                  <feature.icon aria-hidden="true" className="size-5" />
                </span>
                <FeatureStatusBadge status={feature.status} />
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
              {feature.status === "available" && feature.href ? (
                <Button asChild variant="outline" className="mt-4 self-start">
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
            to save a draft, your business profile or a document to history — and then only in this
            browser on this device, not encrypted. Print or save a PDF to keep a copy of a document.
          </p>
        </div>
      </section>
    </div>
  );
}
