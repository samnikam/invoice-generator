import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

/*
 * Dashboard summaries come only from documents saved to History in this browser.
 * Figures are hand-calculated: ₹1,000 at 18% → ₹1,180.00; ₹2,000 at 18% → ₹2,360.00.
 */

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function saveInvoice(page: Page, number: string, price: string) {
  await open(page, "/invoices/new");
  await page.getByLabel("Tax invoice").check();
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Business address").fill("12 MG Road\nPune");
  await page.getByLabel("State of registration").selectOption("27");
  await page.getByLabel("Customer name").fill("Example Retail Pvt Ltd");
  await page.getByLabel("Invoice number").fill(number);
  await page.getByLabel("Place of supply").selectOption("27");
  const row = page.getByTestId("line-item").first();
  await row.getByLabel("Description").fill("Consulting");
  await row.getByLabel("Unit price").fill(price);
  await row.getByLabel("GST treatment").selectOption("taxable");
  await row.getByLabel("GST rate").selectOption("18");
  await page.getByRole("button", { name: "Save to history" }).click();
  await expect(page.getByTestId("history-save-status")).toContainText("Saved to history");
}

async function saveReceipt(page: Page) {
  await open(page, "/receipts/new");
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Receipt number").fill("RCPT-001");
  await page.getByLabel("Payer name").fill("Asha Patel");
  await page.getByLabel("Amount received").fill("500");
  await page.getByLabel("Payment method").selectOption("upi");
  await page.getByRole("button", { name: "Save to history" }).click();
  await expect(page.getByTestId("history-save-status")).toContainText("Saved to history");
}

const stat = (page: Page, id: string) => page.getByTestId(id);

async function smartbillStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((k) => k.startsWith("smartbill."))
        .map((k) => [k, localStorage.getItem(k) ?? ""]),
    ),
  );
}

test.describe("dashboard", () => {
  test("with nothing saved: zero summaries, an empty state and a checklist", async ({ page }) => {
    await open(page, "/dashboard");
    await expect(stat(page, "stat-invoices")).toContainText("₹0.00");
    await expect(stat(page, "stat-invoices")).toContainText("0 invoices");
    await expect(stat(page, "stat-documents")).toContainText("0");
    await expect(page.getByText("No saved documents yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an invoice" })).toHaveAttribute(
      "href",
      "/invoices/new",
    );
    await expect(page.getByText("0 of 3 done")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("summarises saved documents honestly, counting a re-saved number once", async ({ page }) => {
    await saveInvoice(page, "INV-1", "1000"); // ₹1,180.00
    await saveInvoice(page, "INV-2", "1000"); // ₹1,180.00, then re-saved at ₹2,360.00
    await page.getByTestId("line-item").first().getByLabel("Unit price").fill("2000");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Save to history" }).click();
    await expect(page.getByTestId("history-save-status")).toContainText("Saved to history");
    await saveReceipt(page); // ₹500.00

    await open(page, "/dashboard");
    const before = await smartbillStorage(page);

    // INV-1 ₹1,180 + latest INV-2 ₹2,360 = ₹3,540 (not ₹4,720).
    await expect(stat(page, "stat-invoices")).toContainText("₹3,540.00");
    await expect(stat(page, "stat-invoices")).toContainText("2 invoices");
    await expect(stat(page, "stat-receipts")).toContainText("₹500.00");
    await expect(stat(page, "stat-receipts")).toContainText("1 receipt");
    await expect(stat(page, "stat-quotations")).toContainText("₹0.00");
    await expect(stat(page, "stat-documents")).toContainText("3");

    const recent = page.getByTestId("dashboard-recent-item");
    await expect(recent).toHaveCount(3);
    await expect(recent.first()).toContainText("RCPT-001");
    await expect(recent.nth(1)).toContainText("INV-2");
    await expect(recent.nth(1)).toContainText("₹2,360.00");
    await expect(page.getByText("2 of 3 done")).toHaveCount(0); // no profile saved
    await expect(page.getByText("1 of 3 done")).toBeVisible();

    // Long rows must shorten with "…" instead of widening the page on phones.
    await expectNoHorizontalOverflow(page);

    // Viewing the dashboard writes nothing.
    expect(await smartbillStorage(page)).toEqual(before);
  });

  test("“Open” on a recent document opens that record in History", async ({ page }) => {
    await saveInvoice(page, "INV-7", "1000");
    await open(page, "/dashboard");
    await page.getByRole("link", { name: "Open Invoice INV-7" }).click();
    await expect(page).toHaveURL(/\/history\?open=/);
    const view = page.getByTestId("history-record-view");
    await expect(view.getByRole("heading", { name: "Invoice INV-7" })).toBeVisible();
    await expect(view.getByTestId("preview-grand-total")).toHaveText("₹1,180.00");

    // Going back to the list removes the record from the address.
    await view.getByRole("button", { name: "Back to history" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByTestId("history-record")).toHaveCount(1);
  });

  test("a link to a record that no longer exists shows the list with a clear note", async ({
    page,
  }) => {
    await open(page, "/history?open=deleted-record-1");
    await expect(page.getByTestId("history-open-missing")).toContainText("was not found");
    await expect(page.getByTestId("history-record-view")).toHaveCount(0);
  });

  test("the top bar “New” menu offers only the working document tools", async ({ page }) => {
    await open(page, "/dashboard");
    await page.getByRole("banner").getByRole("button", { name: "New" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveCount(3);
    await menu.getByRole("menuitem", { name: /New quotation/ }).click();
    await expect(page).toHaveURL(/\/quotations\/new$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("New quotation");
  });
});
