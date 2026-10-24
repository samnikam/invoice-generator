"use client";

import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { marketingNav } from "@/config/navigation";

/**
 * Website menu for small screens. Radix Dialog handles focus trapping,
 * Escape to close and returning focus to the menu button.
 */
export function MarketingMobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon-lg" className="md:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[85vw] max-w-xs">
        <SheetHeader className="border-b">
          <SheetTitle asChild>
            <div>
              <SheetClose asChild>
                <Logo />
              </SheetClose>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Website navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-3">
          {marketingNav.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link
                href={item.href}
                className="rounded-md px-3 py-2.5 text-base font-medium transition-colors hover:bg-muted"
              >
                {item.title}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto border-t p-4">
          <SheetClose asChild>
            <Button asChild size="xl" className="w-full">
              <Link href="/dashboard">
                Start free demo
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
