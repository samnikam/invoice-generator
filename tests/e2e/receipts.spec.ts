import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

/* Expected figures are hand-calculated, not read back from the app. */

declare global {
  interface Window {
    __printCalls: number;
  }
}

async function open(page: Page) {
  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls += 1;
    };
  });
  await page.goto("/receipts/new");
  await page.waitForLoadState("networkidle");
}

const preview = (page: Page) => page.getByTestId("receipt-preview");

async function showPreview(page: Page) {
  const toggle = page.getByRole("button", { name: "Preview receipt" });
  if (await toggle.isVisible()) await toggle.click();
}
async function showForm(page: Page) {
  const toggle = page.getByRole("button", { name: "Edit details" });
  if (await toggle.isVisible()) await toggle.click();
}

async function fillReceipt(page: Page, amount = "25000.50") {
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Receipt number").fill("RCPT-2026/001");
  await page.getByLabel("Payer name").fill("Example Retail Pvt Ltd");
  await page.getByLabel("Amount received").fill(amount);
  await page.getByLabel("Payment method").selectOption("upi");
}

test.describe("receipt generator", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("defaults the payment date and requires the key fields before printing", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("New payment receipt");
    await expect(page.getByLabel("Payment date")).not.toHaveValue("");
    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "before printing" });
    await expect(summary).toBeFocused();
    for (const text of [
      "Business name",
      "Receipt number",
      "Received from",
      "Amount received",
      "Payment method",
    ]) {
      await expect(summary.getByRole("link", { name: text })).toBeVisible();
    }
    expect(await page.evaluate(() => window.__printCalls)).toBe(0);
  });

  test("rejects zero, negative and badly formatted amounts", async ({ page }) => {
    const amount = page.getByLabel("Amount received");
    const cases: [string, RegExp][] = [
      ["0", /must be more than ₹0/],
      ["-100", /cannot be negative/],
      ["10.555", /at most 2 decimal places/],
      ["1,000", /no commas/],
    ];
    for (const [value, message] of cases) {
      await amount.fill(value);
      await amount.blur();
      await expect(page.locator("#doc-amount-error")).toHaveText(message);
      await expect(amount).toHaveAttribute("aria-invalid", "true");
    }
  });

  test("shows the amount and amount in words, with a clear acknowledgement", async ({ page }) => {
    await fillReceipt(page);
    await page.getByLabel("UPI transaction ID").fill("412345678901");
    await page.getByLabel("Invoice or quotation number").fill("INV-2026/001");
    await expect(page.getByTestId("form-amount-in-words")).toHaveText(
      "Rupees Twenty-Five Thousand and Fifty Paise Only",
    );

    await showPreview(page);
    const doc = preview(page);
    await expect(doc.getByRole("heading", { level: 2 })).toHaveText("Payment Receipt");
    await expect(doc.getByTestId("preview-amount")).toHaveText("₹25,000.50");
    await expect(doc.getByTestId("preview-acknowledgement")).toHaveText(
      "Received with thanks from Example Retail Pvt Ltd the sum of ₹25,000.50 by UPI towards INV-2026/001.",
    );
    await expect(doc.getByTestId("preview-payment-details")).toContainText(
      "UPI transaction ID412345678901",
    );
    await expect(doc.getByTestId("preview-amount-in-words")).toContainText(
      "Rupees Twenty-Five Thousand and Fifty Paise Only",
    );
    await expect(doc.getByTestId("preview-receipt-disclaimer")).toHaveText(
      "This receipt acknowledges the payment shown above. It is not a tax invoice.",
    );
    await expect(doc.getByText(/tax invoice/i)).toHaveCount(1); // only the disclaimer
    await expect(doc.getByTestId("preview-balance")).toHaveCount(0);
  });

  test("optional balance: ₹25,965 total, ₹10,000 earlier, ₹10,000 now → ₹5,965 due", async ({
    page,
  }) => {
    await fillReceipt(page, "10000");
    await page.getByLabel("Invoice total").fill("25965");
    await page.getByLabel("Previously paid").fill("10000");
    await expect(page.getByTestId("form-balance")).toHaveText("₹5,965.00");

    await showPreview(page);
    const balance = preview(page).getByTestId("preview-balance");
    await expect(balance).toContainText("₹25,965.00");
    await expect(balance).toContainText("₹20,000.00"); // total paid
    await expect(preview(page).getByTestId("preview-balance-due")).toHaveText("₹5,965.00");
  });

  test("balance: paid in full, and excess shown when overpaid", async ({ page }) => {
    await fillReceipt(page, "3481.47");
    await page.getByLabel("Invoice total").fill("3481.47");
    await expect(page.getByTestId("form-balance")).toHaveText("Nil — paid in full");

    // ₹1,000 total, ₹400 earlier, ₹700 now → ₹100 excess
    await page.getByLabel("Invoice total").fill("1000");
    await page.getByLabel("Previously paid").fill("400");
    await page.getByLabel("Amount received").fill("700");
    await expect(page.getByTestId("form-balance")).toHaveText("₹100.00");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-excess")).toHaveText("₹100.00");
  });

  test("balance needs the invoice total when “previously paid” is entered", async ({ page }) => {
    await fillReceipt(page, "500");
    const previous = page.getByLabel("Previously paid");
    await previous.fill("200");
    await page.getByLabel("Invoice total").focus();
    await page.getByLabel("Invoice total").blur();
    await expect(page.getByText(/Enter the invoice total to calculate the balance/)).toBeVisible();
    await expect(page.getByTestId("form-balance")).toHaveCount(0);
  });

  test("preview updates as the form changes", async ({ page }) => {
    await fillReceipt(page, "100");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-amount")).toHaveText("₹100.00");
    await showForm(page);
    await page.getByLabel("Amount received").fill("1500");
    await page.getByLabel("Payer name").fill("Another Payer");
    await page.getByLabel("Payment method").selectOption("cheque");
    await expect(page.getByLabel("Cheque number")).toBeVisible();
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-amount")).toHaveText("₹1,500.00");
    await expect(preview(page).getByTestId("preview-payer")).toHaveText("Another Payer");
    await expect(preview(page).getByTestId("preview-acknowledgement")).toContainText("by Cheque");
  });

  test("prints a complete receipt: print layout shows only the receipt", async ({ page }) => {
    await fillReceipt(page);
    await page.getByLabel("Note").fill("Advance for website project");
    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    expect(await page.evaluate(() => window.__printCalls)).toBe(1);

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("form", { name: "Receipt details" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeHidden();
    const doc = preview(page);
    await expect(doc).toBeVisible();
    await expect(doc.getByTestId("preview-receipt-number")).toHaveText("RCPT-2026/001");
    await expect(doc.getByTestId("preview-amount")).toHaveText("₹25,000.50");
    await expect(doc.getByTestId("preview-note")).toHaveText("Advance for website project");
  });

  test("generates a one-page A4 PDF", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() is Chromium-only");
    await fillReceipt(page);
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });

  test("labelled controls and no sideways scrolling", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
    const unlabelled = await page
      .locator("main input:visible, main select:visible, main textarea:visible")
      .evaluateAll((controls) =>
        controls
          .filter(
            (c) =>
              ((c as HTMLInputElement).labels?.length ?? 0) === 0 && !c.getAttribute("aria-label"),
          )
          .map((c) => c.outerHTML),
      );
    expect(unlabelled).toEqual([]);
    await showPreview(page);
    await expectNoHorizontalOverflow(page);
  });
});
