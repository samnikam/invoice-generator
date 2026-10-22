import { siteConfig } from "@/config/site";

// Temporary placeholder. The real landing page is built in Step 1.1.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{siteConfig.name}</h1>
      <p className="max-w-md text-muted-foreground">{siteConfig.tagline}</p>
      <p className="text-sm text-muted-foreground">Project setup complete. Features coming soon.</p>
    </main>
  );
}
