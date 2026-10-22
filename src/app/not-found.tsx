import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center"
    >
      <Logo />
      <p className="mt-10 text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you are looking for does not exist or may not be available yet.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="xl">
          <Link href="/">Go to home page</Link>
        </Button>
        <Button asChild size="xl" variant="outline">
          <Link href="/dashboard">Open workspace</Link>
        </Button>
      </div>
    </main>
  );
}
