import { expect, type Page } from "@playwright/test";

/** Breakpoints matching Tailwind's defaults used in the layouts. */
export const MD = 768; // website header switches to desktop navigation
export const LG = 1024; // workspace sidebar becomes visible

export function viewportWidth(page: Page): number {
  const size = page.viewportSize();
  if (!size) throw new Error("Viewport size is not set");
  return size.width;
}

/** Fails if the page can be scrolled sideways (a common responsive-layout bug). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}

/**
 * Checks every link on the current page points somewhere real:
 * page links must return HTTP 200 and #section links must match an element id.
 */
export async function expectAllLinksWork(page: Page): Promise<void> {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of new Set(hrefs)) {
    expect(href, "links must not be empty or '#'").not.toMatch(/^#?$/);
    const url = new URL(href, page.url());
    expect(url.origin, `unexpected external link: ${href}`).toBe(new URL(page.url()).origin);

    const response = await page.request.get(url.pathname);
    expect(response.status(), `${href} should load`).toBe(200);

    if (url.hash) {
      if (url.pathname === new URL(page.url()).pathname) {
        await expect(page.locator(url.hash), `${href} target section`).toHaveCount(1);
      } else {
        expect(await response.text(), `${href} target section`).toContain(
          `id="${url.hash.slice(1)}"`,
        );
      }
    }
  }
}
