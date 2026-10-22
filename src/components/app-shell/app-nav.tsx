"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { appNav } from "@/config/navigation";

/**
 * Workspace navigation, shared by the desktop sidebar and the mobile menu.
 * Items without an href are tools still in development: they are shown as
 * non-interactive text with a "Soon" label, never as dead links.
 */
export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="flex flex-col gap-6">
      {appNav.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label ? (
            <p className="mb-2 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const itemClass =
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

              if (!item.href) {
                return (
                  <li key={item.title}>
                    <div
                      aria-disabled="true"
                      className={cn(itemClass, "cursor-not-allowed text-muted-foreground/80")}
                    >
                      <item.icon aria-hidden="true" className="size-4" />
                      <span className="flex-1">{item.title}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                        Soon
                      </span>
                    </div>
                  </li>
                );
              }

              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      itemClass,
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon aria-hidden="true" className="size-4" />
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
