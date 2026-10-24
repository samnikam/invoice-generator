import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { marketingNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="dark border-t bg-background text-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">{siteConfig.tagline}.</p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {siteConfig.name} helps you prepare billing documents. It is not government-certified
            software. Please confirm GST registration, rates and invoice requirements with a
            qualified tax professional.
          </p>
        </div>

        <nav aria-label="Footer" className="md:justify-self-end">
          <h2 className="text-sm font-semibold">Product</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {marketingNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.title}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/dashboard"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Workspace
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {siteConfig.name}. Made for Indian small businesses.
        </p>
      </div>
    </footer>
  );
}
