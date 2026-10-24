import { AppNav } from "@/components/app-shell/app-nav";
import { PreviewNotice } from "@/components/app-shell/preview-notice";
import { Logo } from "@/components/brand/logo";

/** Fixed sidebar for large screens. On smaller screens the AppHeader menu is used instead. */
export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar shadow-[1px_0_0_0_var(--sidebar-border)] lg:flex print:hidden">
      <div className="flex h-16 items-center border-b px-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-6">
        <AppNav />
      </div>
      <div className="border-t p-4">
        <PreviewNotice />
      </div>
    </aside>
  );
}
