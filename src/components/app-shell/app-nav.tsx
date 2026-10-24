"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { appNav } from "@/config/navigation";

/**
 * Workspace navigation, shared by the desktop sidebar (dark) and the mobile menu (light).
 * Colours come from the theme's sidebar tokens, so it reads well in both.
 * Items without an href are tools still in development: they are shown as
 * non-interactive text with a "Soon" label, never as dead links.
 */
export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="flex flex-col gap-5">
      {appNav.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label ? (
            <p className="mb-1.5 px-3 text-[0.68rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {group.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const itemClass =
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

              if (!item.href) {
                return (
                  <li key={item.title}>
                    <div
                      aria-disabled="true"
                      className={cn(itemClass, "cursor-not-allowed text-muted-foreground")}
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
                      "group/nav outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      active
                        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-sidebar-primary"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active
                          ? "text-sidebar-primary"
                          : "text-muted-foreground group-hover/nav:text-sidebar-foreground",
                      )}
                    />
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
