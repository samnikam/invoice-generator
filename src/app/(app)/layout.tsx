import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { SkipLink } from "@/components/skip-link";

/** Shared layout for every workspace page (dashboard and, later, each tool). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <AppSidebar />
      <div className="flex min-h-full flex-1 flex-col lg:pl-64 print:pl-0">
        <AppHeader />
        <main id="main" className="flex-1">
          {/* Pages that need more room (e.g. the invoice editor) mark themselves with data-wide-page. */}
          <div className="mx-auto w-full max-w-6xl px-4 py-7 has-[[data-wide-page]]:max-w-screen-2xl sm:px-6 lg:px-8 lg:py-9 print:max-w-none print:p-0">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
