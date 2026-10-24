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
  await page.goto("/quotations/new");
  await page.waitForLoadState("networkidle");
}

const item = (page: Page, index: number) => page.getByTestId("line-item").nth(index);
const preview = (page: Page) => page.getByTestId("document-preview");

async function showPreview(page: Page) {
  const toggle = page.getByRole("button", { name: "Preview quotation" });
  if (await toggle.isVisible()) await toggle.click();
}
async function showForm(page: Page) {
  const toggle = page.getByRole("button", { name: "Edit details" });
  if (await toggle.isVisible()) await toggle.click();
}

async function fillBasics(page: Page, mode: "Quotation with GST" | "Quotation without GST") {
  await page.getByLabel(mode).check();
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Business address").fill("12 MG Road, Pune");
  await page.getByLabel("Customer name").fill("Example Retail Pvt Ltd");
  await page.getByLabel("Quotation number").fill("QT-2026/007");
}

async function fillItem(
  page: Page,
  index: number,
  input: {
    description: string;
    quantity?: string;
    price: string;
    discount?: ["percent" | "amount", string];
    rate?: string;
  },
) {
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

test.describe("quotation generator", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("uses quotation wording and states it is not an invoice", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("New quotation");
    await expect(page.getByLabel("Issue date")).not.toHaveValue("");
    await expect(page.getByLabel("Valid until")).toHaveValue("");
    await expect(
      page.getByText(/It is not an invoice and does not show that anything has been paid/),
    ).toBeVisible();
    await expect(page.getByLabel("Due date")).toHaveCount(0);
  });

  test("printing an incomplete quotation lists the problems instead of printing", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "before printing" });
    await expect(summary).toBeFocused();
    for (const text of [
      "Quotation type",
      "Business name",
      "Customer name",
      "Quotation number",
      "Item 1: description",
      "Item 1: unit price",
    ]) {
      await expect(summary.getByRole("link", { name: text })).toBeVisible();
    }
    expect(await page.evaluate(() => window.__printCalls)).toBe(0);
  });

  test("with GST: GSTIN optional, rate warning shown, CGST + SGST totals", async ({ page }) => {
    await fillBasics(page, "Quotation with GST");
    await expect(page.getByTestId("provisional-rate-notice")).toBeVisible();
    await expect(page.locator('label[for="doc-seller-gstin"]')).toContainText("(optional)");
    await page.getByLabel("State of registration").selectOption("27");
    await page.getByLabel("Place of supply").selectOption("27");
    // 2 × ₹1,250 = ₹2,500, 10% off = ₹2,250, GST 18% = ₹405 (CGST ₹202.50 + SGST ₹202.50) → ₹2,655
    await fillItem(page, 0, {
      description: "Design work",
      quantity: "2",
      price: "1250",
      discount: ["percent", "10"],
      rate: "18",
    });
    // ₹500 − ₹50 = ₹450, GST 5% = ₹22.50 (₹11.25 + ₹11.25) → ₹472.50
    await page.getByRole("button", { name: "Add item" }).click();
    await fillItem(page, 1, {
      description: "Printed brochures",
      price: "500",
      discount: ["amount", "50"],
      rate: "5",
    });
    await expect(page.getByTestId("form-grand-total")).toHaveText("₹3,127.50");

    await showPreview(page);
    const doc = preview(page);
    await expect(doc.getByRole("heading", { level: 2 })).toHaveText("Quotation");
    await expect(doc.getByTestId("preview-document-notice")).toContainText("not an invoice");
    await expect(doc.getByTestId("preview-discount")).toHaveText("−₹300.00");
    await expect(doc.getByTestId("preview-cgst")).toHaveText("₹213.75");
    await expect(doc.getByTestId("preview-sgst")).toHaveText("₹213.75");
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹3,127.50");
    await expect(doc.getByTestId("preview-amount-in-words")).toHaveText(
      "Rupees Three Thousand One Hundred Twenty-Seven and Fifty Paise Only",
    );
    await expect(doc.getByTestId("preview-acceptance")).toContainText("Accepted by customer");
  });

  test("with GST, inter-state: IGST", async ({ page }) => {
    await fillBasics(page, "Quotation with GST");
    await page.getByLabel("State of registration").selectOption("27");
    await page.getByLabel("Place of supply").selectOption("29");
    // ₹10,000 at 18% IGST = ₹1,800 → ₹11,800
    await fillItem(page, 0, { description: "Consulting", price: "10000", rate: "18" });
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-igst")).toHaveText("₹1,800.00");
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹11,800.00");
  });

  test("without GST: no tax, no GST fields, and a clear note", async ({ page }) => {
    await fillBasics(page, "Quotation without GST");
    await expect(page.getByLabel(/^GSTIN/)).toHaveCount(0);
    await expect(page.getByTestId("provisional-rate-notice")).toHaveCount(0);
    // 3 × ₹1,999.99 = ₹5,999.97
    await fillItem(page, 0, {
      description: "Monthly maintenance",
      quantity: "3",
      price: "1999.99",
    });
    await showPreview(page);
    const doc = preview(page);
    await expect(doc.getByTestId("preview-non-gst-note")).toContainText("No GST has been added");
    await expect(doc.getByTestId("preview-cgst")).toHaveCount(0);
    await expect(doc.getByTestId("preview-igst")).toHaveCount(0);
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹5,999.97");
  });

  test("adds and removes items; preview follows", async ({ page }) => {
    await fillBasics(page, "Quotation without GST");
    await fillItem(page, 0, { description: "First", price: "100" });
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(item(page, 1).getByLabel("Description")).toBeFocused();
    await fillItem(page, 1, { description: "Second", price: "250.50" });
    await expect(page.getByTestId("form-grand-total")).toHaveText("₹350.50");

    await item(page, 0).getByRole("button", { name: "Remove item 1" }).click();
    await expect(page.getByTestId("line-item")).toHaveCount(1);
    await expect(page.getByTestId("form-grand-total")).toHaveText("₹250.50");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-line")).toHaveCount(1);
    await expect(preview(page).getByTestId("preview-line")).toContainText("Second");
  });

  test("validity date is checked and shown", async ({ page }) => {
    await page.getByLabel("Issue date").fill("2026-10-23");
    const valid = page.getByLabel("Valid until");
    await valid.fill("2026-10-01");
    await valid.blur();
    await expect(page.getByText("“Valid until” cannot be before the issue date.")).toBeVisible();
    await valid.fill("2026-11-22");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-end-date")).toHaveText("22 Nov 2026");
    await showForm(page);
  });

  test("prints a complete quotation: print layout shows only the document", async ({ page }) => {
    await fillBasics(page, "Quotation without GST");
    await fillItem(page, 0, {
      description:
        "Complete shop renovation including electrical rewiring, false ceiling, painting of all walls, and installation of new display racks",
      quantity: "1",
      price: "125000",
    });
    await page.getByRole("textbox", { name: /^Terms/ }).fill("50% advance with order");
    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    expect(await page.evaluate(() => window.__printCalls)).toBe(1);

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("form", { name: "Quotation details" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
    const doc = preview(page);
    await expect(doc).toBeVisible();
    await expect(doc.getByTestId("preview-document-number")).toHaveText("QT-2026/007");
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹1,25,000.00");
    await expect(doc.getByTestId("preview-terms")).toHaveText("50% advance with order");
    await expect(doc.getByText("Complete shop renovation", { exact: false })).toBeVisible();
  });

  test("generates a one-page A4 PDF", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() is Chromium-only");
    await fillBasics(page, "Quotation without GST");
    await fillItem(page, 0, { description: "Consulting", price: "5000" });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });

  test("labelled controls and no sideways scrolling", async ({ page }) => {
    await page.getByLabel("Quotation with GST").check();
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
