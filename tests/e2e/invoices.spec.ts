import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

/*
 * Expected figures are hand-calculated (and were independently checked with Python's
 * Decimal in the Step 1.2 audit), not read back from the app.
 */

declare global {
  interface Window {
    __printCalls: number;
  }
}

async function open(page: Page) {
  // Replace window.print so tests can confirm it was called without opening a dialog.
  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls += 1;
    };
  });
  await page.goto("/invoices/new");
  await page.waitForLoadState("networkidle");
}

const item = (page: Page, index: number) => page.getByTestId("line-item").nth(index);
const preview = (page: Page) => page.getByTestId("document-preview");

async function showPreview(page: Page) {
  const toggle = page.getByRole("button", { name: "Preview invoice" });
  if (await toggle.isVisible()) await toggle.click();
}
async function showForm(page: Page) {
  const toggle = page.getByRole("button", { name: "Edit details" });
  if (await toggle.isVisible()) await toggle.click();
}

async function fillHeader(
  page: Page,
  { sellerState = "27", gstin = "27AAPFU0939F1ZV", placeOfSupply = "27" } = {},
) {
  await page.getByLabel("Tax invoice").check();
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Business address").fill("12 MG Road\nPune");
  await page.getByLabel("State of registration").selectOption(sellerState);
  await page.getByLabel("GSTIN", { exact: true }).fill(gstin);
  await page.getByLabel("Customer name").fill("Example Retail Pvt Ltd");
  await page.getByLabel("Invoice number").fill("INV-2026/001");
  await page.getByLabel("Place of supply").selectOption(placeOfSupply);
}

type ItemInput = {
  description: string;
  quantity?: string;
  price: string;
  discount?: ["percent" | "amount", string];
  rate?: string;
};

async function fillItem(page: Page, index: number, input: ItemInput) {
  const row = item(page, index);
  await row.getByLabel("Description").fill(input.description);
  await row.getByLabel("Quantity").fill(input.quantity ?? "1");
  await row.getByLabel("Unit price").fill(input.price);
  if (input.discount) {
    await row.getByLabel("Discount", { exact: true }).selectOption(input.discount[0]);
    await row
      .getByLabel(input.discount[0] === "percent" ? "Discount %" : "Discount amount")
      .fill(input.discount[1]);
  }
  if (input.rate) {
    await row.getByLabel("GST treatment").selectOption("taxable");
    await row.getByLabel("GST rate").selectOption(input.rate);
  }
}

/** The three-item example: totals ₹3,481.47 intra-state, ₹3,481.46 inter-state. */
async function fillThreeItems(page: Page) {
  await fillItem(page, 0, {
    description: "Design work",
    quantity: "2",
    price: "1250",
    discount: ["percent", "10"],
    rate: "18",
  });
  await page.getByRole("button", { name: "Add item" }).click();
  await fillItem(page, 1, {
    description: "Printed brochures",
    quantity: "1.5",
    price: "333.33",
    discount: ["amount", "50"],
    rate: "5",
  });
  await page.getByRole("button", { name: "Add item" }).click();
  await fillItem(page, 2, { description: "Courier", quantity: "3", price: "99.99", rate: "18" });
}

test.describe("invoice generator", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("defaults the invoice date to today and shows privacy and rate notices", async ({
    page,
  }) => {
    await expect(page.getByLabel("Invoice date")).not.toHaveValue("");
    await expect(
      page.getByText(/details stay in this tab only and are cleared when you refresh/),
    ).toBeVisible();
    await expect(page.getByTestId("provisional-rate-notice")).toHaveCount(0);
    await page.getByLabel("Tax invoice").check();
    await expect(page.getByTestId("provisional-rate-notice")).toBeVisible();
    await expect(page.getByTestId("provisional-rate-notice")).toContainText("not been verified");
  });

  test("printing an incomplete invoice lists the problems instead of printing", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "before printing" });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    for (const text of [
      "Invoice type",
      "Business name",
      "Customer name",
      "Invoice number",
      "Item 1: description",
      "Item 1: unit price",
    ]) {
      await expect(summary.getByRole("link", { name: text })).toBeVisible();
    }
    expect(await page.evaluate(() => window.__printCalls)).toBe(0);

    // The summary links move focus to the field.
    await summary.getByRole("link", { name: "Business name" }).click();
    await expect(page.getByLabel("Business name")).toBeFocused();
    await expect(page.getByLabel("Business name")).toHaveAttribute("aria-invalid", "true");
  });

  test("shows a field error after leaving a required field empty", async ({ page }) => {
    await page.getByLabel("Business name").focus();
    await page.getByLabel("Business name").blur();
    await expect(page.getByText("Business name is required.")).toBeVisible();
  });

  test("validates GSTIN format and state", async ({ page }) => {
    await page.getByLabel("Tax invoice").check();
    await page.getByLabel("State of registration").selectOption("29");
    const gstin = page.getByLabel("GSTIN", { exact: true });
    await gstin.fill("27AAPFU0939F1ZV");
    await gstin.blur();
    await expect(page.getByText(/belongs to state code 27/)).toBeVisible();
    await gstin.fill("27AAPFU0939F1ZA");
    await expect(page.getByText(/check character does not match/)).toBeVisible();
  });

  test("adds and removes items, keeping at least one", async ({ page }) => {
    await expect(page.getByTestId("line-item")).toHaveCount(1);
    await expect(item(page, 0).getByRole("button", { name: "Remove item 1" })).toBeDisabled();

    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByTestId("line-item")).toHaveCount(2);
    await expect(item(page, 1).getByLabel("Description")).toBeFocused();

    await item(page, 0).getByLabel("Description").fill("First");
    await item(page, 1).getByLabel("Description").fill("Second");
    await item(page, 0).getByRole("button", { name: "Remove item 1" }).click();
    await expect(page.getByTestId("line-item")).toHaveCount(1);
    await expect(item(page, 0).getByLabel("Description")).toHaveValue("Second");
  });

  test("intra-state, three items with % and fixed discounts: CGST + SGST, ₹3,481.47", async ({
    page,
  }) => {
    await fillHeader(page);
    await fillThreeItems(page);

    await expect(item(page, 0).getByTestId("line-total")).toHaveText("₹2,655.00");
    await expect(item(page, 1).getByTestId("line-total")).toHaveText("₹472.50");
    await expect(item(page, 2).getByTestId("line-total")).toHaveText("₹353.97");
    await expect(page.getByTestId("form-grand-total")).toHaveText("₹3,481.47");

    await showPreview(page);
    const doc = preview(page);
    await expect(doc.getByTestId("preview-supply-type")).toHaveText(
      "Intra-state supply (CGST + SGST)",
    );
    await expect(doc.getByTestId("preview-line")).toHaveCount(3);
    await expect(doc.getByTestId("preview-discount")).toHaveText("−₹300.00");
    await expect(doc.getByTestId("preview-cgst")).toHaveText("₹240.75");
    await expect(doc.getByTestId("preview-sgst")).toHaveText("₹240.75");
    await expect(doc.getByTestId("preview-igst")).toHaveCount(0);
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹3,481.47");
    await expect(doc.getByTestId("preview-amount-in-words")).toHaveText(
      "Rupees Three Thousand Four Hundred Eighty-One and Forty-Seven Paise Only",
    );
  });

  test("round off is shown transparently: −₹0.47 → ₹3,481.00", async ({ page }) => {
    await fillHeader(page);
    await fillThreeItems(page);
    await page.getByLabel(/Round the total to the nearest rupee/).check();
    await expect(page.getByTestId("form-grand-total")).toHaveText("₹3,481.00");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-round-off")).toHaveText("−₹0.47");
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹3,481.00");
    await expect(preview(page).getByTestId("preview-amount-in-words")).toHaveText(
      "Rupees Three Thousand Four Hundred Eighty-One Only",
    );
  });

  test("inter-state: IGST ₹481.49, total ₹3,481.46", async ({ page }) => {
    await fillHeader(page, { placeOfSupply: "29" });
    await fillThreeItems(page);
    await showPreview(page);
    const doc = preview(page);
    await expect(doc.getByTestId("preview-supply-type")).toHaveText("Inter-state supply (IGST)");
    await expect(doc.getByTestId("preview-igst")).toHaveText("₹481.49");
    await expect(doc.getByTestId("preview-cgst")).toHaveCount(0);
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹3,481.46");
  });

  test("union territory without legislature: CGST + UTGST", async ({ page }) => {
    await fillHeader(page, { sellerState: "04", gstin: "04AAAAA0000A1ZA", placeOfSupply: "04" });
    await fillItem(page, 0, { description: "Consulting", price: "10000", rate: "18" });
    await showPreview(page);
    const doc = preview(page);
    await expect(doc.getByTestId("preview-supply-type")).toHaveText(
      "Intra-state supply (CGST + UTGST)",
    );
    await expect(doc.getByText("UTGST", { exact: true }).first()).toBeVisible();
    await expect(doc.getByTestId("preview-sgst")).toHaveText("₹900.00");
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹11,800.00");
  });

  test("invoice without GST: no GST fields, no tax, clear note", async ({ page }) => {
    await page.getByLabel("Invoice without GST").check();
    await expect(page.getByLabel("GSTIN", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("State of registration")).toHaveCount(0);
    await expect(page.getByLabel("GST treatment")).toHaveCount(0);
    await expect(page.getByTestId("provisional-rate-notice")).toHaveCount(0);

    await page.getByLabel("Business name").fill("Small Tutor");
    await page.getByLabel("Business address").fill("Nagpur");
    await page.getByLabel("Customer name").fill("A Parent");
    await page.getByLabel("Invoice number").fill("T-17");
    // 4 × ₹750.00 = ₹3,000.00, less ₹250.00 = ₹2,750.00
    await fillItem(page, 0, {
      description: "Maths tuition (hours)",
      quantity: "4",
      price: "750",
      discount: ["amount", "250"],
    });

    await showPreview(page);
    const doc = preview(page);
    await expect(doc.getByRole("heading", { level: 2 })).toHaveText("Invoice");
    await expect(doc.getByTestId("preview-non-gst-note")).toContainText("No GST has been charged");
    await expect(doc.getByTestId("preview-cgst")).toHaveCount(0);
    await expect(doc.getByTestId("preview-igst")).toHaveCount(0);
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹2,750.00");
  });

  test("preview updates as the form changes", async ({ page }) => {
    await fillHeader(page);
    await fillItem(page, 0, { description: "Widget", quantity: "2", price: "100", rate: "18" });
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-customer")).toHaveText(
      "Example Retail Pvt Ltd",
    );
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹236.00");

    await showForm(page);
    await page.getByLabel("Customer name").fill("Another Customer");
    await item(page, 0).getByLabel("Quantity").fill("3");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-customer")).toHaveText("Another Customer");
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹354.00");
  });

  test("prints a complete invoice: print layout shows only the invoice", async ({ page }) => {
    await fillHeader(page, { placeOfSupply: "29" });
    await fillThreeItems(page);
    await page.getByLabel("Notes or payment details").fill("UPI: sample@upi");
    await expect(page.getByRole("alert").filter({ hasText: "before printing" })).toHaveCount(0);

    const titleBefore = await page.title();
    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    expect(await page.evaluate(() => window.__printCalls)).toBe(1);
    await expect(page).toHaveTitle(titleBefore); // title restored after printing

    // What the printer / "Save as PDF" receives, even while the form tab is showing.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("form", { name: "Invoice details" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeHidden();
    const doc = preview(page);
    await expect(doc).toBeVisible();
    await expect(doc.getByTestId("preview-document-number")).toHaveText("INV-2026/001");
    await expect(doc.getByTestId("preview-place-of-supply")).toHaveText("Karnataka (29)");
    await expect(doc.getByTestId("preview-line")).toHaveCount(3);
    await expect(doc.getByTestId("preview-igst")).toHaveText("₹481.49");
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹3,481.46");
    await expect(doc.getByTestId("preview-notes")).toHaveText("UPI: sample@upi");
    await expect(doc.getByText(/Preview — fill in/)).toHaveCount(0);
  });

  test("generates a one-page A4 PDF with Chromium's print engine", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "page.pdf() is Chromium-only");
    await fillHeader(page);
    await fillThreeItems(page);
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pageCount).toBe(1);
  });

  test("Clear form asks for confirmation before clearing", async ({ page }) => {
    await page.getByLabel("Business name").fill("Keep me");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Clear form" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("Keep me");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear form" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("");
  });

  test("usable layout: labelled controls, no sideways scrolling, edit/preview switch", async ({
    page,
  }) => {
    await page.getByLabel("Tax invoice").check();
    await expectNoHorizontalOverflow(page);
    const unlabelled = await page
      .locator("main input:visible, main select:visible, main textarea:visible")
      .evaluateAll((controls) =>
        controls
          .filter((c) => {
            const el = c as HTMLInputElement;
            return (el.labels?.length ?? 0) === 0 && !el.getAttribute("aria-label");
          })
          .map((c) => c.outerHTML),
      );
    expect(unlabelled).toEqual([]);

    const previewToggle = page.getByRole("button", { name: "Preview invoice" });
    if (await previewToggle.isVisible()) {
      await previewToggle.click();
      await expect(previewToggle).toHaveAttribute("aria-pressed", "true");
      await expect(preview(page)).toBeVisible();
      await expect(page.getByRole("form", { name: "Invoice details" })).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
  });
});
