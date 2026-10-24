"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, Menu, Plus } from "lucide-react";

import { AppNav } from "@/components/app-shell/app-nav";
import { BusinessBadge } from "@/components/app-shell/business-badge";
import { PreviewNotice } from "@/components/app-shell/preview-notice";
import { Logo } from "@/components/brand/logo";
import { NewDocumentLink } from "@/components/documents/new-document-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createActions, findNavLocation } from "@/config/navigation";

/** "+ New" menu: shortcuts to the available document tools. */
function NewDocumentMenu() {
  if (createActions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg" className="gap-1.5 px-3 sm:px-3.5">
          <Plus data-icon="inline-start" />
          New
          <ChevronDown aria-hidden="true" className="-mr-0.5 size-3.5 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        {createActions.map((action) => (
          <DropdownMenuItem key={action.href} asChild>
            <NewDocumentLink href={action.href} kind={action.kind}>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <action.icon aria-hidden="true" className="size-4" />
              </span>
              <span className="leading-tight">
                <span className="block font-medium">{action.label}</span>
                <span className="block text-xs text-muted-foreground">{action.description}</span>
              </span>
            </NewDocumentLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = findNavLocation(usePathname());

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 shadow-[0_1px_2px_0_oklch(0.21_0.03_262/0.04)] backdrop-blur supports-backdrop-filter:bg-card/80 sm:px-6 print:hidden">
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
          <div className="space-y-3 border-t p-3">
            <BusinessBadge onNavigate={() => setMenuOpen(false)} />
            <PreviewNotice />
          </div>
        </SheetContent>
      </Sheet>

      <Logo className="lg:hidden" />

      {/* Where you are: "Sales › Invoices" (plain text, not links). */}
      <p className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
        {location?.group ? (
          <>
            <span className="text-muted-foreground">{location.group}</span>
            <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground/70" />
          </>
        ) : null}
        <span className="truncate font-semibold text-foreground">
          {location?.item.title ?? "Workspace"}
        </span>
      </p>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <NewDocumentMenu />
        <Button asChild variant="ghost" size="lg" className="px-2.5 sm:px-3">
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
