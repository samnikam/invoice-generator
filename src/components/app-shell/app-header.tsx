"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu } from "lucide-react";

import { AppNav } from "@/components/app-shell/app-nav";
import { PreviewNotice } from "@/components/app-shell/preview-notice";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { appNav } from "@/config/navigation";

function usePageTitle(): string {
  const pathname = usePathname();
  const item = appNav
    .flatMap((group) => group.items)
    .find((i) => i.href && (pathname === i.href || pathname.startsWith(`${i.href}/`)));
  return item?.title ?? "Workspace";
}

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const title = usePageTitle();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6 print:hidden">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon-lg"
            className="lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] max-w-xs">
          <SheetHeader className="border-b">
            <SheetTitle asChild>
              <div>
                <Logo />
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">Workspace navigation</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3">
            <AppNav onNavigate={() => setMenuOpen(false)} />
          </div>
          <div className="border-t p-4">
            <PreviewNotice />
          </div>
        </SheetContent>
      </Sheet>

      <Logo className="lg:hidden" />
      <p className="hidden text-sm font-medium text-muted-foreground lg:block">{title}</p>

      <div className="ml-auto">
        <Button asChild variant="ghost" size="lg">
          <Link href="/">
            <ExternalLink data-icon="inline-start" />
            <span className="hidden sm:inline">Website</span>
            <span className="sr-only sm:hidden">Website home</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
