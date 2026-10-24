import { AppNav } from "@/components/app-shell/app-nav";
import { BusinessBadge } from "@/components/app-shell/business-badge";
import { PreviewNotice } from "@/components/app-shell/preview-notice";
import { Logo } from "@/components/brand/logo";

/**
 * Fixed sidebar for large screens. On smaller screens the AppHeader menu is used instead.
 * The `dark` class switches this panel (only) to the dark theme tokens.
 */
export function AppSidebar() {
  return (
    <aside className="dark fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex print:hidden">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <AppNav />
      </div>
      <div className="space-y-3 border-t border-sidebar-border p-3">
        <BusinessBadge />
        <PreviewNotice />
      </div>
    </aside>
  );
}
