import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

/*
 * Place-of-supply suggestion from the customer's GSTIN (offline, first two digits).
 * It is only a suggestion: the place of supply changes only when the user accepts it.
 * 27AAPFU0939F1ZV is the published valid example (Maharashtra); 29AAPFU0939F1ZR is the same
 * PAN with Karnataka's code and a correct check character (test data only).
 */
const MAHARASHTRA_GSTIN = "27AAPFU0939F1ZV";
const KARNATAKA_GSTIN = "29AAPFU0939F1ZR";

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const customerGstin = (page: Page) => page.getByLabel("Customer GSTIN");
const placeOfSupply = (page: Page) => page.getByLabel("Place of supply");
const suggestion = (page: Page) => page.getByTestId("pos-suggestion");
const useButton = (page: Page, state: string) =>
  page.getByRole("button", { name: `Use ${state} as place of supply` });

test.describe("GSTIN state suggestion on a tax invoice", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Tax invoice").check();
  });

  test("suggests the GSTIN's state but changes nothing until accepted", async ({ page }) => {
    await expect(suggestion(page)).toHaveCount(0);
    await customerGstin(page).fill(MAHARASHTRA_GSTIN);
    await expect(suggestion(page)).toContainText(
      "The customer’s GSTIN is registered in Maharashtra (27).",
    );
    await expect(suggestion(page)).toContainText("depends on the transaction");
    // Not applied automatically.
    await expect(placeOfSupply(page)).toHaveValue("");

    await useButton(page, "Maharashtra (27)").click();
    await expect(placeOfSupply(page)).toHaveValue("27");
    await expect(placeOfSupply(page)).toBeFocused();
    await expect(suggestion(page)).toHaveCount(0);
    await expect(page.getByTestId("pos-suggestion-match")).toHaveText(
      "Matches the state in the customer’s GSTIN: Maharashtra (27).",
    );
  });

  test("never overwrites a place of supply chosen by the user", async ({ page }) => {
    await placeOfSupply(page).selectOption("29");
    await customerGstin(page).fill(MAHARASHTRA_GSTIN);
    await expect(suggestion(page)).toContainText("but a different place of supply is selected");
    await expect(placeOfSupply(page)).toHaveValue("29");

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(suggestion(page)).toHaveCount(0);
    await expect(placeOfSupply(page)).toHaveValue("29");

    // A different GSTIN brings a fresh suggestion; the choice is still untouched.
    await customerGstin(page).fill(KARNATAKA_GSTIN);
    await expect(page.getByTestId("pos-suggestion-match")).toContainText("Karnataka (29)");
    await customerGstin(page).fill(MAHARASHTRA_GSTIN);
    await expect(suggestion(page)).toHaveCount(0); // still dismissed for this GSTIN
    await expect(placeOfSupply(page)).toHaveValue("29");
  });

  test("shows nothing for an incomplete or invalid GSTIN", async ({ page }) => {
    for (const value of ["27", "27AAPFU0939F1Z", "27AAPFU0939F1ZA", "99AAPFU0939F1ZV"]) {
      await customerGstin(page).fill(value);
      await expect(suggestion(page)).toHaveCount(0);
      await expect(page.getByTestId("pos-suggestion-match")).toHaveCount(0);
    }
    // The existing validation message is unchanged.
    await customerGstin(page).fill("27AAPFU0939F1ZA");
    await customerGstin(page).blur();
    await expect(page.getByText(/check character does not match/)).toBeVisible();
  });

  test("works the same for lower-case input", async ({ page }) => {
    await customerGstin(page).fill("27aapfu0939f1zv");
    await expect(useButton(page, "Maharashtra (27)")).toBeVisible();
  });

  test("tax figures follow the place of supply, as before", async ({ page }) => {
    await page.getByLabel("Business name").fill("Sample Design Studio");
    await page.getByLabel("Business address").fill("12 MG Road, Pune");
    await page.getByLabel("State of registration").selectOption("27");
    await page.getByLabel("Customer name").fill("Example Retail Pvt Ltd");
    await page.getByLabel("Invoice number").fill("INV-1");
    const row = page.getByTestId("line-item").first();
    await row.getByLabel("Description").fill("Consulting");
    await row.getByLabel("Unit price").fill("1000");
    await row.getByLabel("GST treatment").selectOption("taxable");
    await row.getByLabel("GST rate").selectOption("18");

    // Karnataka customer GSTIN; seller in Maharashtra → accepting gives IGST ₹180 → ₹1,180.
    await customerGstin(page).fill(KARNATAKA_GSTIN);
    await useButton(page, "Karnataka (29)").click();
    const preview = page.getByTestId("document-preview");
    const toggle = page.getByRole("button", { name: "Preview invoice" });
    if (await toggle.isVisible()) await toggle.click();
    await expect(preview.getByTestId("preview-igst")).toHaveText("₹180.00");
    await expect(preview.getByTestId("preview-grand-total")).toHaveText("₹1,180.00");
  });

  test("is not saved: drafts keep exactly the same fields", async ({ page }) => {
    await page.getByLabel("Save draft in this browser").click();
    await customerGstin(page).fill(MAHARASHTRA_GSTIN);
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByTestId("draft-status")).toContainText("Saved in this browser");
    const keys = await page.evaluate(() =>
      Object.keys(
        JSON.parse(localStorage.getItem("smartbill.draft.v1.invoice") ?? "{}").values ?? {},
      ).sort(),
    );
    expect(keys).toEqual(
      [
        "amountReceived",
        "customer",
        "documentNumber",
        "dueDate",
        "gstMode",
        "issueDate",
        "kind",
        "lines",
        "notes",
        "paymentMode",
        "placeOfSupply",
        "recipientIsSez",
        "roundOff",
        "seller",
        "sellerLogo",
        "terms",
        "validUntil",
      ].sort(),
    );
  });

  test("fits on small screens", async ({ page }) => {
    await customerGstin(page).fill(MAHARASHTRA_GSTIN);
    await expect(suggestion(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("GSTIN state suggestion elsewhere", () => {
  test("works on a quotation with GST", async ({ page }) => {
    await open(page, "/quotations/new");
    await page.getByLabel("Quotation with GST").check();
    await page.getByLabel("Customer GSTIN").fill(MAHARASHTRA_GSTIN);
    await useButton(page, "Maharashtra (27)").click();
    await expect(placeOfSupply(page)).toHaveValue("27");
  });

  test("does not appear on an invoice without GST (no place of supply there)", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Invoice without GST").check();
    await customerGstin(page).fill(MAHARASHTRA_GSTIN);
    await expect(placeOfSupply(page)).toHaveCount(0);
    await expect(suggestion(page)).toHaveCount(0);
  });
});
