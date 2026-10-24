import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { MarketingMobileNav } from "@/components/marketing/mobile-nav";
import { Button } from "@/components/ui/button";
import { marketingNav } from "@/config/navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/85 shadow-[0_1px_2px_0_oklch(0.21_0.03_262/0.04)] backdrop-blur-md supports-backdrop-filter:bg-card/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="lg"
            className="hidden rounded-full px-5 shadow-md shadow-primary/20 sm:inline-flex"
          >
            <Link href="/dashboard">
              Open workspace
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <MarketingMobileNav />
        </div>
      </div>
    </header>
  );
}
