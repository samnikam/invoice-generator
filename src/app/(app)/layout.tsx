import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { SkipLink } from "@/components/skip-link";

/** Shared layout for every workspace page (dashboard and, later, each tool). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <AppSidebar />
      <div className="flex min-h-full flex-1 flex-col lg:pl-64">
        <AppHeader />
        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">{children}</div>
        </main>
      </div>
    </>
  );
}
