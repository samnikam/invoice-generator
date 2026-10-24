import { expect, test, type Page } from "@playwright/test";

/*
 * Green invoice layout, optional logo, amount received / balance due, payment mode.
 * Expected figures are hand-calculated. The "TEST LOGO" image is generated in the test
 * (a screenshot of styled text) — it is test data, not real branding.
 */

const LOGO_KEY = "smartbill.profile.v1.logo";
const GREEN_DARK = "rgb(26, 85, 41)"; // #1A5529
const GREEN_LIGHT = "rgb(122, 214, 148)"; // #7AD694
const GREEN_PALE = "rgb(209, 241, 218)"; // #D1F1DA

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function testLogoPng(page: Page): Promise<Buffer> {
  await page.setContent(
    `<div id="l" style="display:inline-block;padding:16px 24px;background:#e8eef9;color:#1f3a8a;font:700 36px Arial">TEST LOGO</div>`,
  );
  return page.locator("#l").screenshot();
}

async function saveProfile(page: Page, { withLogo }: { withLogo: boolean }) {
  const logo = withLogo ? await testLogoPng(page) : null;
  await open(page, "/settings/business");
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Business address").fill("12 MG Road\nPune");
  await page.getByLabel("GSTIN").fill("27AAPFU0939F1ZV");
  await page.getByLabel("State of registration").selectOption("27");
  if (logo) {
    await page
      .locator("#profile-logo")
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
    await expect(page.getByTestId("profile-logo-preview")).toBeVisible();
  }
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");
}

async function showPreview(page: Page, noun = "invoice") {
  const toggle = page.getByRole("button", { name: `Preview ${noun}` });
  if (await toggle.isVisible()) await toggle.click();
}
async function showForm(page: Page) {
  const toggle = page.getByRole("button", { name: "Edit details" });
  if (await toggle.isVisible()) await toggle.click();
}

const preview = (page: Page) => page.getByTestId("document-preview");

/** A tax invoice with one item; seller state 27, place of supply as given. */
async function fillInvoice(
  page: Page,
  { price, rate, placeOfSupply = "27" }: { price: string; rate: string; placeOfSupply?: string },
) {
  await page.getByLabel("Tax invoice").check();
  await page.getByLabel("Customer name").fill("Example Retail Pvt Ltd");
  await page.getByLabel("Invoice number").fill("INV-2026/042");
  await page.getByLabel("Place of supply").selectOption(placeOfSupply);
  const row = page.getByTestId("line-item").first();
  await row.getByLabel("Description").fill("Consulting");
  await row.getByLabel("Unit price").fill(price);
  await row.getByLabel("GST treatment").selectOption("taxable");
  await row.getByLabel("GST rate").selectOption(rate);
}

test.describe("business profile logo", () => {
  test("upload, save, reload and remove; nothing stored before Save", async ({ page }) => {
    const logo = await testLogoPng(page);
    await open(page, "/settings/business");
    await page.getByLabel("Business name").fill("Sample Design Studio");
    await page
      .locator("#profile-logo")
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
    await expect(page.getByTestId("profile-logo-preview")).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), LOGO_KEY)).toBeNull();

    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");
    const stored = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k) ?? "null"),
      LOGO_KEY,
    );
    expect(stored.version).toBe(1);
    expect(stored.dataUrl).toMatch(/^data:image\/png;base64,/);

    // The stored image was resized to fit 400 × 160.
    const size = await page.evaluate(async (src: string) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }, stored.dataUrl as string);
    expect(size.w).toBeLessThanOrEqual(400);
    expect(size.h).toBeLessThanOrEqual(160);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("profile-logo-preview")).toBeVisible();

    await page.getByRole("button", { name: "Remove logo" }).click();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");
    expect(await page.evaluate((k) => localStorage.getItem(k), LOGO_KEY)).toBeNull();
  });

  test("rejects SVG and non-image files with a clear message", async ({ page }) => {
    await open(page, "/settings/business");
    await page.locator("#profile-logo").setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    });
    await expect(page.getByText("Choose a PNG or JPEG image.")).toBeVisible();
    await page.locator("#profile-logo").setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("this is not an image"),
    });
    await expect(page.getByText("This file could not be read as an image.")).toBeVisible();
    await expect(page.getByTestId("profile-logo-preview")).toHaveCount(0);
  });

  test("deleting the profile also deletes the logo", async ({ page }) => {
    await saveProfile(page, { withLogo: true });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete profile" }).click();
    await expect(page.getByTestId("profile-status")).toHaveText(
      "Business profile deleted from this browser.",
    );
    expect(await page.evaluate((k) => localStorage.getItem(k), LOGO_KEY)).toBeNull();
  });
});

test.describe("logo on documents", () => {
  test("new invoices show the profile logo; it can be removed from one invoice", async ({
    page,
  }) => {
    await saveProfile(page, { withLogo: true });
    await open(page, "/invoices/new");
    await expect(page.getByTestId("form-logo-preview")).toBeVisible();
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-logo")).toBeVisible();
    await expect(preview(page).getByTestId("preview-logo")).toHaveAttribute(
      "alt",
      "Sample Design Studio logo",
    );

    await showForm(page);
    await page.getByRole("button", { name: "Remove logo from this invoice" }).click();
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-logo")).toHaveCount(0);
    // The profile keeps its logo.
    expect(await page.evaluate((k) => localStorage.getItem(k), LOGO_KEY)).not.toBeNull();
  });

  test("quotations and receipts never show the logo", async ({ page }) => {
    await saveProfile(page, { withLogo: true });
    await open(page, "/quotations/new");
    await showPreview(page, "quotation");
    await expect(page.getByTestId("document-preview").locator("img")).toHaveCount(0);
    await open(page, "/receipts/new");
    await showPreview(page, "receipt");
    await expect(page.getByTestId("receipt-preview").locator("img")).toHaveCount(0);
  });

  test("invoices work normally without a logo", async ({ page }) => {
    await saveProfile(page, { withLogo: false });
    await open(page, "/invoices/new");
    await expect(page.getByTestId("form-logo-preview")).toHaveCount(0);
    await fillInvoice(page, { price: "1000", rate: "18" });
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-logo")).toHaveCount(0);
    await expect(preview(page).getByTestId("preview-company")).toContainText(
      "Sample Design Studio",
    );
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹1,180.00");
  });
});

test.describe("green invoice layout", () => {
  test("uses the reference colours for the company block, banner, total row and terms", async ({
    page,
  }) => {
    await saveProfile(page, { withLogo: false });
    await open(page, "/invoices/new");
    await fillInvoice(page, { price: "1000", rate: "18" });
    await page.getByRole("textbox", { name: /^Terms/ }).fill("Payment within 30 days");
    await showPreview(page);
    const doc = preview(page);
    const bg = (locator: ReturnType<Page["locator"]>) =>
      locator.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg(doc.getByTestId("preview-company"))).toBe(GREEN_DARK);
    expect(await bg(doc.getByRole("heading", { level: 2 }).locator(".."))).toBe(GREEN_DARK);
    expect(await bg(doc.getByTestId("preview-items-total").locator(".."))).toBe(GREEN_LIGHT);
    expect(await bg(doc.getByTestId("preview-terms").locator(".."))).toBe(GREEN_PALE);
    await expect(doc.getByRole("heading", { level: 2 })).toHaveText("Tax Invoice");
    await expect(doc.getByTestId("preview-seal-signature")).toContainText("Seal & Signature");
  });

  test("intra-state 18%: tax rows show the real half rates, never a fixed 14%", async ({
    page,
  }) => {
    await saveProfile(page, { withLogo: false });
    await open(page, "/invoices/new");
    // ₹1,000 at 18% → CGST ₹90 + SGST ₹90 → ₹1,180
    await fillInvoice(page, { price: "1000", rate: "18" });
    await showPreview(page);
    const totals = preview(page).getByTestId("preview-totals");
    await expect(totals).toContainText("Add: CGST @ 9%");
    await expect(totals).toContainText("Add: SGST @ 9%");
    await expect(preview(page).getByTestId("preview-cgst")).toHaveText("₹90.00");
    await expect(preview(page).getByTestId("preview-sgst")).toHaveText("₹90.00");
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹1,180.00");
    await expect(preview(page)).not.toContainText("14%");
    await expect(preview(page).getByTestId("preview-items-total")).toHaveText("₹1,000.00");
  });

  test("inter-state 5%: a single IGST row at the real rate", async ({ page }) => {
    await saveProfile(page, { withLogo: false });
    await open(page, "/invoices/new");
    // ₹2,000 at 5% IGST → ₹100 → ₹2,100
    await fillInvoice(page, { price: "2000", rate: "5", placeOfSupply: "29" });
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-totals")).toContainText("Add: IGST @ 5%");
    await expect(preview(page).getByTestId("preview-igst")).toHaveText("₹100.00");
    await expect(preview(page).getByTestId("preview-cgst")).toHaveCount(0);
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹2,100.00");
  });
});

test.describe("amount received and balance due", () => {
  test.beforeEach(async ({ page }) => {
    await saveProfile(page, { withLogo: false });
    await open(page, "/invoices/new");
    // ₹1,000 at 18% intra-state → grand total ₹1,180.00
    await fillInvoice(page, { price: "1000", rate: "18" });
  });

  test("no received / balance rows until an amount is entered", async ({ page }) => {
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-amount-received")).toHaveCount(0);
    await expect(preview(page).getByTestId("preview-balance-due")).toHaveCount(0);
    await expect(preview(page)).not.toContainText("Amount received");
  });

  test("part payment: ₹1,180 − ₹500 = ₹680 due", async ({ page }) => {
    await page.getByLabel("Amount received").fill("500");
    await expect(page.getByTestId("form-balance-due")).toHaveText("₹680.00");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-amount-received")).toHaveText("₹500.00");
    await expect(preview(page).getByTestId("preview-balance-due")).toHaveText("₹680.00");
  });

  test("paid in full", async ({ page }) => {
    await page.getByLabel("Amount received").fill("1180");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-balance-due")).toHaveText("Nil — paid in full");
  });

  test("overpayment is shown honestly: ₹1,500 received → ₹320 in excess", async ({ page }) => {
    await page.getByLabel("Amount received").fill("1500");
    await expect(page.getByTestId("form-balance-due")).toHaveText("₹320.00");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-balance-due")).toHaveText("Nil");
    await expect(preview(page).getByTestId("preview-excess")).toHaveText("₹320.00");
  });

  test("rejects ₹0 and invalid amounts, and shows no balance", async ({ page }) => {
    const received = page.getByLabel("Amount received");
    await received.fill("0");
    await received.blur();
    await expect(page.getByText(/Amount received must be more than ₹0/)).toBeVisible();
    await received.fill("12.345");
    await expect(page.getByText(/at most 2 decimal places/)).toBeVisible();
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-amount-received")).toHaveCount(0);
  });

  test("payment mode is printed on the invoice", async ({ page }) => {
    await page.getByLabel("Payment mode").fill("UPI: studio@okbank");
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-payment-mode")).toHaveText(
      "UPI: studio@okbank",
    );
  });
});

test.describe("printing and compatibility", () => {
  test("prints one A4 page with only the invoice, logo and balance included", async ({
    page,
    browserName,
  }) => {
    await saveProfile(page, { withLogo: true });
    await open(page, "/invoices/new");
    await fillInvoice(page, { price: "1000", rate: "18" });
    await page.getByLabel("Amount received").fill("500");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("form", { name: "Invoice details" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
    const doc = preview(page);
    await expect(doc).toBeVisible();
    await expect(doc.getByTestId("preview-logo")).toBeVisible();
    await expect(doc.getByTestId("preview-balance-due")).toHaveText("₹680.00");
    if (browserName === "chromium") {
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
    }
  });

  test("an invoice draft saved before these fields existed still restores", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.evaluate(() => {
      const values = {
        kind: "invoice",
        gstMode: "without-gst",
        seller: {
          name: "Older Draft Business",
          address: "Pune",
          phone: "",
          email: "",
          gstin: "",
          stateCode: "",
        },
        customer: { name: "Older Customer", address: "", phone: "", email: "", gstin: "" },
        documentNumber: "OLD-1",
        issueDate: "2026-10-01",
        dueDate: "",
        validUntil: "",
        placeOfSupply: "",
        recipientIsSez: false,
        lines: [
          {
            id: "line-1",
            description: "Older item",
            hsnSac: "",
            quantity: "2",
            unitPrice: "250",
            discountKind: "none",
            discountValue: "",
            treatment: "",
            rateId: "",
          },
        ],
        notes: "",
        terms: "",
        roundOff: false,
        // no amountReceived / paymentMode / sellerLogo — saved by an earlier version
      };
      localStorage.setItem(
        "smartbill.draft.v1.invoice",
        JSON.stringify({ version: 1, kind: "invoice", savedAt: new Date().toISOString(), values }),
      );
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Save draft in this browser")).toBeChecked();
    await expect(page.getByLabel("Business name")).toHaveValue("Older Draft Business");
    await expect(page.getByLabel("Amount received")).toHaveValue("");
    await expect(page.getByTestId("draft-notice")).toHaveCount(0);
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-grand-total")).toHaveText("₹500.00");
  });

  test("quotations keep their existing design", async ({ page }) => {
    await saveProfile(page, { withLogo: true });
    await open(page, "/quotations/new");
    await showPreview(page, "quotation");
    const doc = preview(page);
    await expect(doc.getByTestId("preview-acceptance")).toBeVisible();
    await expect(doc.getByTestId("preview-company")).toHaveCount(0);
    await expect(doc.getByTestId("preview-seal-signature")).toHaveCount(0);
    await expect(doc.getByRole("heading", { level: 2 })).toHaveText("Quotation");
  });
});

test.describe("optional GSTIN", () => {
  /** Profile with a state but no GSTIN — nothing invented or filled in for the user. */
  async function saveProfileWithoutGstin(page: Page) {
    await open(page, "/settings/business");
    await page.getByLabel("Business name").fill("Sample Design Studio");
    await page.getByLabel("Business address").fill("12 MG Road\nPune");
    await page.getByLabel("State of registration").selectOption("27");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");
  }

  test("the profile saves and updates with an empty GSTIN", async ({ page }) => {
    await saveProfile(page, { withLogo: false });
    await page.getByLabel("GSTIN").fill("");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("GSTIN")).toHaveValue("");
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("smartbill.profile.v1") ?? "null"),
    );
    expect(stored.profile.gstin).toBe("");
  });

  test("a tax invoice without a GSTIN is valid, keeps its GST, and omits the GSTIN", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printCalls: number }).__printCalls = 0;
      window.print = () => {
        (window as unknown as { __printCalls: number }).__printCalls += 1;
      };
    });
    await saveProfileWithoutGstin(page);
    await open(page, "/invoices/new");
    // ₹1,000 at 18% intra-state → CGST ₹90 + SGST ₹90 → ₹1,180, exactly as with a GSTIN.
    await fillInvoice(page, { price: "1000", rate: "18" });
    const gstin = page.getByLabel(/^GSTIN/);
    await expect(gstin).toHaveValue("");
    await expect(page.locator('label[for="doc-seller-gstin"]')).toContainText("(optional)");
    await gstin.blur();
    await expect(page.getByText(/GSTIN is required/)).toHaveCount(0);

    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "before printing" })).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls),
    ).toBe(1);

    await page.emulateMedia({ media: "print" });
    const doc = preview(page);
    await expect(doc).toBeVisible();
    await expect(doc.getByRole("heading", { level: 2 })).toHaveText("Tax Invoice");
    await expect(doc.getByTestId("preview-company")).toContainText("Sample Design Studio");
    await expect(doc).not.toContainText("GSTIN");
    await expect(doc.getByTestId("preview-cgst")).toHaveText("₹90.00");
    await expect(doc.getByTestId("preview-sgst")).toHaveText("₹90.00");
    await expect(doc.getByTestId("preview-grand-total")).toHaveText("₹1,180.00");
    await expect(doc.getByTestId("preview-non-gst-note")).toHaveCount(0);
  });

  test("an entered GSTIN is still checked on the invoice", async ({ page }) => {
    await saveProfileWithoutGstin(page);
    await open(page, "/invoices/new");
    await fillInvoice(page, { price: "1000", rate: "18" });
    const gstin = page.getByLabel(/^GSTIN/);
    await gstin.fill("12345");
    await gstin.blur();
    await expect(page.getByText("GSTIN must be exactly 15 characters.")).toBeVisible();
    await gstin.fill("27AAPFU0939F1ZA");
    await expect(page.getByText(/check character does not match/)).toBeVisible();
    await gstin.fill("27AAPFU0939F1ZV");
    await expect(page.getByText(/check character does not match/)).toHaveCount(0);
    await showPreview(page);
    await expect(preview(page).getByTestId("preview-company")).toContainText(
      "GSTIN: 27AAPFU0939F1ZV",
    );
  });
});
