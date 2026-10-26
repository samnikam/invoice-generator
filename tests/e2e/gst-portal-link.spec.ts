import { expect, test, type Page } from "@playwright/test";

/*
 * "Look up GSTIN on the official GST Portal ↗": a plain link that opens the portal's
 * Search Taxpayer page in a new tab. SmartBill sends no data to it. The portal itself is
 * never contacted by these tests (requests to it are blocked).
 */
const PORTAL_URL = "https://services.gst.gov.in/services/searchtp";

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const portalLink = (page: Page) =>
  page.getByRole("link", {
    name: "Look up GSTIN on the official GST Portal (opens in a new tab)",
  });

test.describe("GST Portal look-up link", () => {
  test("is shown under Customer GSTIN with safe new-tab attributes", async ({ page }) => {
    await open(page, "/invoices/new");
    const link = portalLink(page);
    await expect(link).toBeVisible();
    await expect(link).toHaveText(
      "Look up GSTIN on the official GST Portal ↗ (opens in a new tab)",
    );
    await expect(link).toHaveAttribute("href", PORTAL_URL);
    await expect(link).toHaveAttribute("target", "_blank");
    const rel = (await link.getAttribute("rel")) ?? "";
    expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
  });

  test("never carries SmartBill data: the address stays fixed after typing", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Customer name").fill("Example Retail Pvt Ltd");
    await page.getByLabel("Customer GSTIN").fill("27AAPFU0939F1ZV");
    await expect(page.getByTestId("customer-pan")).toBeVisible(); // existing PAN hint unchanged
    await expect(portalLink(page)).toHaveAttribute("href", PORTAL_URL);
  });

  test("opens the portal in a new tab, with nothing added to the address", async ({
    page,
    context,
  }) => {
    // Never contact the real portal from tests: answer with a local placeholder page and
    // record exactly which address the new tab asked for.
    const requested: string[] = [];
    await context.route("https://services.gst.gov.in/**", (route) => {
      requested.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" });
    });
    await open(page, "/invoices/new");
    await page.getByLabel("Customer GSTIN").fill("27AAPFU0939F1ZV");
    const [popup] = await Promise.all([context.waitForEvent("page"), portalLink(page).click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(PORTAL_URL);
    expect(requested).toEqual([PORTAL_URL]); // no GSTIN, name or PAN in the request
    // The SmartBill tab stays where it was, with the form intact.
    await expect(page).toHaveURL(/\/invoices\/new$/);
    await expect(page.getByLabel("Customer GSTIN")).toHaveValue("27AAPFU0939F1ZV");
    await popup.close();
  });

  test("is also on quotations, but not on receipts (which have no GSTIN)", async ({ page }) => {
    await open(page, "/quotations/new");
    await expect(portalLink(page)).toHaveAttribute("href", PORTAL_URL);
    await open(page, "/receipts/new");
    await expect(page.getByTestId("gst-portal-link")).toHaveCount(0);
  });

  test("is not printed", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("gst-portal-link")).toBeHidden();
    await expect(page.getByTestId("document-preview")).not.toContainText("GST Portal");
  });
});
