import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

/*
 * Customer & document history (browser-local). Figures are hand-calculated:
 * ₹1,000 at 18% within one state → CGST ₹90 + SGST ₹90 → ₹1,180.00.
 */

const DOC_PREFIX = "smartbill.history.v1.doc.";
const LOGO_PREFIX = "smartbill.history.v1.logo.";

declare global {
  interface Window {
    __prints: string[];
  }
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Replace window.print so tests can see it was called (and with which title). */
async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    window.__prints = [];
    window.print = () => {
      window.__prints.push(document.title);
    };
  });
}

async function storageKeys(page: Page, prefix: string): Promise<string[]> {
  return page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p)), prefix);
}

async function fillInvoice(
  page: Page,
  {
    number = "INV-2026/001",
    customer = "Example Retail Pvt Ltd",
    phone = "+91 98765 43210",
    price = "1000",
  } = {},
) {
  await page.getByLabel("Tax invoice").check();
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Business address").fill("12 MG Road\nPune");
  await page.getByLabel("State of registration").selectOption("27");
  await page.getByLabel("Customer name").fill(customer);
  await page.locator("#doc-customer-phone").fill(phone);
  await page.getByLabel("Invoice number").fill(number);
  await page.getByLabel("Invoice date").fill("2026-10-24");
  await page.getByLabel("Place of supply").selectOption("27");
  const row = page.getByTestId("line-item").first();
  await row.getByLabel("Description").fill("Consulting");
  await row.getByLabel("Unit price").fill(price);
  await row.getByLabel("GST treatment").selectOption("taxable");
  await row.getByLabel("GST rate").selectOption("18");
}

async function fillQuotation(page: Page) {
  await page.getByLabel("Quotation without GST").check();
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Business address").fill("12 MG Road, Pune");
  await page.getByLabel("Customer name").fill("Bright Traders");
  await page.locator("#doc-customer-phone").fill("022 2345 6789");
  await page.getByLabel("Quotation number").fill("QT-2026/007");
  await page.getByLabel("Issue date").fill("2026-10-20");
  const row = page.getByTestId("line-item").first();
  await row.getByLabel("Description").fill("Design work");
  await row.getByLabel("Unit price").fill("2500");
}

async function fillReceipt(page: Page) {
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Receipt number").fill("RCPT-001");
  await page.getByLabel("Payment date").fill("2026-10-23");
  await page.getByLabel("Payer name").fill("Asha Patel");
  await page.locator("#doc-payer-phone").fill("98200 11223");
  await page.getByLabel("Amount received").fill("2500.50");
  await page.getByLabel("Payment method").selectOption("upi");
}

async function saveToHistory(page: Page) {
  await page.getByRole("button", { name: "Save to history" }).click();
  await expect(page.getByTestId("history-save-status")).toContainText("Saved to history");
}

/** Saves one invoice, one quotation and one receipt. */
async function saveOneOfEach(page: Page) {
  await open(page, "/invoices/new");
  await fillInvoice(page);
  await saveToHistory(page);
  await open(page, "/quotations/new");
  await fillQuotation(page);
  await saveToHistory(page);
  await open(page, "/receipts/new");
  await fillReceipt(page);
  await saveToHistory(page);
}

const records = (page: Page) => page.getByTestId("history-record");

test.describe("saving to history", () => {
  test("is refused for an incomplete document, listing the problems", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.getByRole("button", { name: "Save to history" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "before saving to history" });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link", { name: "Invoice number" })).toBeVisible();
    expect(await storageKeys(page, "smartbill.history.")).toEqual([]);
  });

  test("is an explicit action: printing does not save, saving does not print", async ({ page }) => {
    await stubPrint(page);
    await open(page, "/invoices/new");
    await fillInvoice(page);

    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    expect(await page.evaluate(() => window.__prints.length)).toBe(1);
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(0);

    await saveToHistory(page);
    const status = page.getByTestId("history-save-status");
    await expect(status).toContainText("stored on this device only");
    await expect(status).not.toContainText(/sent/i);
    expect(await page.evaluate(() => window.__prints.length)).toBe(1);
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(1);
    // Drafts are still off and untouched; nothing else was written.
    expect(await storageKeys(page, "smartbill.draft.")).toEqual([]);

    // The message disappears once the form is edited (it no longer matches what was saved).
    await page.getByLabel("Customer name").fill("Someone else");
    await expect(status).not.toContainText("Saved to history");
  });

  test("asks before saving a second copy of the same number, and keeps both", async ({ page }) => {
    await open(page, "/invoices/new");
    await fillInvoice(page);
    await saveToHistory(page);

    let dialogText = "";
    page.once("dialog", (d) => {
      dialogText = d.message();
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Save to history" }).click();
    await expect.poll(() => dialogText).toContain("INV-2026/001 is already in your history");
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(1);

    page.once("dialog", (d) => void d.accept());
    await saveToHistory(page);
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(2);
  });
});

test.describe("history page", () => {
  test("explains where records are stored and shows an empty state", async ({ page }) => {
    await open(page, "/history");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Document history");
    await expect(page.getByTestId("history-privacy")).toContainText(
      "in this browser on this device only",
    );
    await expect(page.getByTestId("history-privacy")).toContainText("not synced");
    await expect(page.getByTestId("history-count")).toHaveText("No saved documents yet.");
    await expect(page.getByRole("link", { name: "New invoice" })).toHaveAttribute(
      "href",
      "/invoices/new",
    );
  });

  test("lists type, number, customer, date and total, newest first", async ({ page }) => {
    await saveOneOfEach(page);
    await open(page, "/history");
    await expect(records(page)).toHaveCount(3);
    await expect(page.getByTestId("history-count")).toHaveText("Showing 3 of 3 saved documents.");

    const [first, second, third] = [
      records(page).nth(0),
      records(page).nth(1),
      records(page).nth(2),
    ];
    await expect(first).toContainText("Receipt");
    await expect(first.getByTestId("history-record-number")).toHaveText("RCPT-001");
    await expect(first.getByTestId("history-record-customer")).toHaveText("Asha Patel");
    await expect(first.getByTestId("history-record-date")).toHaveText("23 Oct 2026");
    await expect(first.getByTestId("history-record-total")).toHaveText("₹2,500.50");

    await expect(second).toContainText("Quotation");
    await expect(second.getByTestId("history-record-total")).toHaveText("₹2,500.00");

    await expect(third).toContainText("Invoice");
    await expect(third.getByTestId("history-record-number")).toHaveText("INV-2026/001");
    await expect(third.getByTestId("history-record-total")).toHaveText("₹1,180.00");
    await expectNoHorizontalOverflow(page);
  });

  test("searches by customer name or mobile number, and filters by type", async ({ page }) => {
    await saveOneOfEach(page);
    await open(page, "/history");
    const search = page.getByLabel("Search by customer name or mobile number");
    const numbers = () => records(page).getByTestId("history-record-number").allTextContents();

    await search.fill("asha");
    expect(await numbers()).toEqual(["RCPT-001"]);
    await search.fill("98765-43210");
    expect(await numbers()).toEqual(["INV-2026/001"]);
    await search.fill("+91 98765 43210");
    expect(await numbers()).toEqual(["INV-2026/001"]);
    await search.fill("nobody");
    await expect(page.getByText("No saved documents match your search.")).toBeVisible();

    await search.fill("");
    const types = page.getByRole("group", { name: "Document type" });
    await types.getByRole("button", { name: "Quotations" }).click();
    await expect(types.getByRole("button", { name: "Quotations" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await numbers()).toEqual(["QT-2026/007"]);
    await types.getByRole("button", { name: "Invoices" }).click();
    expect(await numbers()).toEqual(["INV-2026/001"]);
    await search.fill("asha");
    await expect(records(page)).toHaveCount(0);
    await types.getByRole("button", { name: "All" }).click();
    expect(await numbers()).toEqual(["RCPT-001"]);
  });

  test("opens a saved invoice exactly as saved, and reprints it", async ({ page }) => {
    await stubPrint(page);
    await open(page, "/invoices/new");
    await fillInvoice(page);
    await saveToHistory(page);
    await page.getByRole("link", { name: "View history" }).click();
    await expect(page).toHaveURL(/\/history$/);

    await page
      .getByRole("button", { name: "Open Invoice INV-2026/001 for Example Retail Pvt Ltd" })
      .click();
    const view = page.getByTestId("history-record-view");
    await expect(view.getByRole("heading", { name: "Invoice INV-2026/001" })).toBeFocused();
    const doc = view.getByTestId("document-preview");
    await expect(doc.getByRole("heading", { level: 2 })).toHaveText("Tax Invoice");
    await expect(doc.getByTestId("preview-cgst")).toHaveText("₹90.00");
    await expect(doc.getByTestId("preview-sgst")).toHaveText("₹90.00");
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹1,180.00");

    await view.getByRole("button", { name: "Print / Save as PDF" }).click();
    expect(await page.evaluate(() => window.__prints)).toEqual(["Invoice INV-2026/001"]);

    // Printed output: only the document.
    await page.emulateMedia({ media: "print" });
    await expect(doc).toBeVisible();
    await expect(view.getByRole("button", { name: "Back to history" })).toBeHidden();
    await expect(page.getByTestId("history-privacy")).toBeHidden();
    await page.emulateMedia({ media: "screen" });

    await view.getByRole("button", { name: "Back to history" }).click();
    await expect(page.getByLabel("Search by customer name or mobile number")).toBeFocused();
  });

  test("a saved record is a snapshot: later edits and new saves do not change it", async ({
    page,
  }) => {
    await open(page, "/invoices/new");
    await fillInvoice(page);
    await saveToHistory(page);
    // Same invoice number, new price: saved as a separate record after confirming.
    await page.getByTestId("line-item").first().getByLabel("Unit price").fill("2000");
    page.once("dialog", (d) => void d.accept());
    await saveToHistory(page);

    await open(page, "/history");
    const totals = records(page).getByTestId("history-record-total");
    await expect(totals).toHaveText(["₹2,360.00", "₹1,180.00"]);
    await records(page).nth(1).getByRole("button", { name: /^Open/ }).click();
    await expect(page.getByTestId("preview-grand-total")).toHaveText("₹1,180.00");
  });

  test("opens saved quotations and receipts in their own layouts", async ({ page }) => {
    await saveOneOfEach(page);
    await open(page, "/history");
    await page.getByRole("button", { name: /^Open Quotation QT-2026\/007/ }).click();
    await expect(page.getByTestId("preview-acceptance")).toBeVisible();
    await expect(page.getByTestId("preview-grand-total")).toHaveText("₹2,500.00");
    await page.getByRole("button", { name: "Back to history" }).click();
    await page.getByRole("button", { name: /^Open Receipt RCPT-001/ }).click();
    await expect(page.getByTestId("receipt-preview")).toContainText("Asha Patel");
    await expect(page.getByTestId("receipt-preview")).toContainText("₹2,500.50");
  });

  test("keeps the invoice logo, storing it once", async ({ page }) => {
    // A generated test image (not real branding), saved in the business profile.
    await page.setContent(
      `<div id="l" style="display:inline-block;padding:16px 24px;background:#e8eef9;font:700 36px Arial">TEST LOGO</div>`,
    );
    const logo = await page.locator("#l").screenshot();
    await open(page, "/settings/business");
    await page.getByLabel("Business name").fill("Sample Design Studio");
    await page.getByLabel("Business address").fill("12 MG Road\nPune");
    await page
      .locator("#profile-logo")
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");

    for (const number of ["INV-1", "INV-2"]) {
      await open(page, "/invoices/new");
      await fillInvoice(page, { number });
      await saveToHistory(page);
    }
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(2);
    expect(await storageKeys(page, LOGO_PREFIX)).toHaveLength(1);

    await open(page, "/history");
    await page.getByRole("button", { name: /^Open Invoice INV-1 / }).click();
    await expect(page.getByTestId("preview-logo")).toBeVisible();
  });

  test("deletes a record after confirming, leaving drafts and the profile alone", async ({
    page,
  }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Save draft in this browser").click();
    await fillInvoice(page);
    await saveToHistory(page);
    await expect.poll(() => storageKeys(page, "smartbill.draft.")).toHaveLength(1);

    await open(page, "/history");
    await records(page).first().getByRole("button", { name: /^Open/ }).click();
    page.once("dialog", (d) => void d.dismiss());
    await page.getByRole("button", { name: "Delete" }).click();
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(1);

    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("history-message")).toContainText(
      "Invoice INV-2026/001 was deleted from history.",
    );
    await expect(page.getByTestId("history-count")).toHaveText("No saved documents yet.");
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(0);
    expect(await storageKeys(page, "smartbill.draft.")).toHaveLength(1);
  });

  test("reports unreadable records without hiding the others, and deletes them on request", async ({
    page,
  }) => {
    await open(page, "/receipts/new");
    await fillReceipt(page);
    await saveToHistory(page);
    await page.evaluate((key) => localStorage.setItem(key, "{damaged"), `${DOC_PREFIX}damaged-001`);

    await open(page, "/history");
    await expect(records(page)).toHaveCount(1);
    const notice = page.getByTestId("history-damaged");
    await expect(notice).toContainText("1 saved record could not be read");
    page.once("dialog", (d) => void d.accept());
    await notice.getByRole("button", { name: "Delete unreadable records" }).click();
    await expect(notice).toHaveCount(0);
    await expect(records(page)).toHaveCount(1);
    expect(await storageKeys(page, DOC_PREFIX)).toHaveLength(1);
  });

  test("never reprints a record whose figures would now differ", async ({ page }) => {
    await open(page, "/invoices/new");
    await fillInvoice(page);
    await saveToHistory(page);
    // Simulate a saved total that today's rules no longer produce.
    await page.evaluate((prefix) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith(prefix))!;
      const record = JSON.parse(localStorage.getItem(key)!);
      record.summary.totalPaise = 100000;
      localStorage.setItem(key, JSON.stringify(record));
    }, DOC_PREFIX);

    await open(page, "/history");
    await expect(records(page).first().getByTestId("history-record-total")).toHaveText("₹1,000.00");
    await records(page).first().getByRole("button", { name: /^Open/ }).click();
    await expect(page.getByTestId("history-record-changed")).toContainText(
      "cannot be printed again",
    );
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toHaveCount(0);
    await expect(page.getByTestId("document-preview")).toHaveCount(0);
  });

  test("is reachable from the workspace navigation", async ({ page }) => {
    await open(page, "/dashboard");
    const menu = page.getByRole("button", { name: "Open navigation menu" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Document history");
  });
});
