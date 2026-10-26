import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

/*
 * "Find a past customer" (customers from History saved in this browser only) and
 * "PAN (from GSTIN)" (shown on screen only). 27AAPFU0939F1ZV is the published valid example
 * GSTIN; its PAN part is AAPFU0939F.
 */
const GSTIN = "27AAPFU0939F1ZV";
const PAN = "AAPFU0939F";

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Saves a finished invoice to History with the given customer. */
async function saveInvoice(
  page: Page,
  number: string,
  customer: { name: string; phone?: string; address?: string; gstin?: string },
) {
  await open(page, "/invoices/new");
  await page.getByLabel("Tax invoice").check();
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Business address").fill("12 MG Road, Pune");
  await page.getByLabel("State of registration").selectOption("27");
  await page.getByLabel("Customer name").fill(customer.name);
  if (customer.address) await page.getByLabel("Customer address").fill(customer.address);
  if (customer.phone) await page.locator("#doc-customer-phone").fill(customer.phone);
  if (customer.gstin) await page.getByLabel("Customer GSTIN").fill(customer.gstin);
  await page.getByLabel("Invoice number").fill(number);
  await page.getByLabel("Place of supply").selectOption("27");
  const row = page.getByTestId("line-item").first();
  await row.getByLabel("Description").fill("Consulting");
  await row.getByLabel("Unit price").fill("1000");
  await row.getByLabel("GST treatment").selectOption("taxable");
  await row.getByLabel("GST rate").selectOption("18");
  await page.getByRole("button", { name: "Save to history" }).click();
  await expect(page.getByTestId("history-save-status")).toContainText("Saved to history");
}

async function saveReceipt(page: Page, number: string, payer: string, phone: string) {
  await open(page, "/receipts/new");
  await page.getByLabel("Business name").fill("Sample Design Studio");
  await page.getByLabel("Receipt number").fill(number);
  await page.getByLabel("Payer name").fill(payer);
  await page.locator("#doc-payer-phone").fill(phone);
  await page.getByLabel("Amount received").fill("500");
  await page.getByLabel("Payment method").selectOption("upi");
  await page.getByRole("button", { name: "Save to history" }).click();
  await expect(page.getByTestId("history-save-status")).toContainText("Saved to history");
}

const finder = (page: Page) => page.getByLabel("Find a past customer");
const results = (page: Page) => page.getByTestId("past-customer-result");

test.describe("Find a past customer", () => {
  test("with nothing saved, says so and changes nothing", async ({ page }) => {
    await open(page, "/invoices/new");
    await finder(page).fill("exa");
    await expect(page.getByTestId("past-customer-message")).toHaveText(
      "No saved customers yet. Customers appear here after you use “Save to history”.",
    );
    await expect(results(page)).toHaveCount(0);
    await expect(page.getByLabel("Customer name")).toHaveValue("");
  });

  test("finds by partial name, fills only after choosing, and leaves the rest alone", async ({
    page,
  }) => {
    await saveInvoice(page, "INV-1", {
      name: "Example Retail Pvt Ltd",
      phone: "+91 98765 43210",
      address: "4 Park Street\nMumbai",
      gstin: GSTIN,
    });
    await saveInvoice(page, "INV-2", { name: "Bright Traders", phone: "022 2345 6789" });

    await open(page, "/invoices/new");
    await page.getByLabel("Tax invoice").check();
    await finder(page).fill("retail");
    await expect(results(page)).toHaveCount(1);
    const result = results(page).first();
    await expect(result).toContainText("Example Retail Pvt Ltd");
    await expect(result).toContainText(`GSTIN ${GSTIN}`);
    await expect(result).toContainText("+91 98765 43210");
    await expect(result).toContainText("4 Park Street, Mumbai");
    await expect(result).toContainText("Last: Invoice INV-1");
    // Nothing is filled until a result is chosen.
    await expect(page.getByLabel("Customer name")).toHaveValue("");

    await page.getByRole("button", { name: "Use customer: Example Retail Pvt Ltd" }).click();
    await expect(page.getByLabel("Customer name")).toHaveValue("Example Retail Pvt Ltd");
    await expect(page.getByLabel("Customer address")).toHaveValue("4 Park Street\nMumbai");
    await expect(page.locator("#doc-customer-phone")).toHaveValue("+91 98765 43210");
    await expect(page.getByLabel("Customer GSTIN")).toHaveValue(GSTIN);
    await expect(finder(page)).toHaveValue("");
    // Place of supply is not changed (only the existing suggestion appears).
    await expect(page.getByLabel("Place of supply")).toHaveValue("");
    await expect(page.getByTestId("pos-suggestion")).toBeVisible();
    // Other details are untouched.
    await expect(page.getByLabel("Invoice number")).toHaveValue("");
  });

  test("finds by mobile number and merges repeated customers into one result", async ({ page }) => {
    await saveReceipt(page, "RCPT-1", "Asha Patel", "98200 11223");
    await saveReceipt(page, "RCPT-2", "asha patel", "+91 98200-11223"); // same person, same mobile
    await open(page, "/invoices/new");
    await finder(page).fill("9820011223");
    await expect(results(page)).toHaveCount(1);
    await expect(results(page).first()).toContainText("2 saved documents");
    await expect(results(page).first()).toContainText("Last: Receipt RCPT-2");
  });

  test("asks before replacing customer details already typed; Cancel keeps them", async ({
    page,
  }) => {
    await saveInvoice(page, "INV-1", { name: "Bright Traders", phone: "022 2345 6789" });
    await open(page, "/invoices/new");
    await page.getByLabel("Customer name").fill("Someone Typed");

    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await finder(page).fill("bright");
    await page.getByRole("button", { name: "Use customer: Bright Traders" }).click();
    await expect.poll(() => message).toContain("Replace the customer details");
    await expect(page.getByLabel("Customer name")).toHaveValue("Someone Typed");
    await expect(results(page)).toHaveCount(1); // the search stays open

    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Use customer: Bright Traders" }).click();
    await expect(page.getByLabel("Customer name")).toHaveValue("Bright Traders");
  });

  test("no match shows a clear message", async ({ page }) => {
    await saveInvoice(page, "INV-1", { name: "Bright Traders" });
    await open(page, "/invoices/new");
    await finder(page).fill("nobody");
    await expect(page.getByTestId("past-customer-message")).toHaveText(
      "No past customer matches this search.",
    );
  });

  test("works on a quotation and fits on small screens", async ({ page }) => {
    await saveInvoice(page, "INV-1", { name: "Bright Traders", phone: "022 2345 6789" });
    await open(page, "/quotations/new");
    await finder(page).fill("brig");
    await expect(results(page)).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Use customer: Bright Traders" }).click();
    await expect(page.getByLabel("Customer name")).toHaveValue("Bright Traders");
  });

  test("searching does not change saved History or drafts", async ({ page }) => {
    await saveInvoice(page, "INV-1", { name: "Bright Traders" });
    await open(page, "/invoices/new");
    const snapshot = () =>
      page.evaluate(() =>
        Object.fromEntries(
          Object.keys(localStorage)
            .filter((k) => k.startsWith("smartbill."))
            .map((k) => [k, localStorage.getItem(k)]),
        ),
      );
    const before = await snapshot();
    await finder(page).fill("bright");
    await expect(results(page)).toHaveCount(1);
    await page.getByRole("button", { name: "Use customer: Bright Traders" }).click();
    expect(await snapshot()).toEqual(before);
  });
});

test.describe("PAN from the customer GSTIN", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/invoices/new");
  });

  test("shows the PAN only for a valid GSTIN", async ({ page }) => {
    const gstin = page.getByLabel("Customer GSTIN");
    for (const value of ["27", "27AAPFU0939F1Z", "27AAPFU0939F1ZA", "99AAPFU0939F1ZV"]) {
      await gstin.fill(value);
      await expect(page.getByTestId("customer-pan")).toHaveCount(0);
    }
    await gstin.fill(GSTIN);
    await expect(page.getByTestId("customer-pan")).toHaveText(
      `PAN (from GSTIN): ${PAN} — shown here only, not saved or printed.`,
    );
    await gstin.fill("27aapfu0939f1zv");
    await expect(page.getByTestId("customer-pan")).toContainText(PAN);
    await gstin.fill("");
    await expect(page.getByTestId("customer-pan")).toHaveCount(0);
  });

  test("is not saved in the draft and not printed", async ({ page }) => {
    await page.getByLabel("Tax invoice").check();
    await page.getByLabel("Save draft in this browser").click();
    await page.getByLabel("Customer GSTIN").fill(GSTIN);
    await expect(page.getByTestId("customer-pan")).toBeVisible();
    await expect(page.getByTestId("draft-status")).toContainText("Saved in this browser");

    const customer = await page.evaluate(
      () => JSON.parse(localStorage.getItem("smartbill.draft.v1.invoice") ?? "{}").values?.customer,
    );
    expect(Object.keys(customer).sort()).toEqual(["address", "email", "gstin", "name", "phone"]);
    expect(customer.gstin).toBe(GSTIN);

    await page.emulateMedia({ media: "print" });
    const doc = page.getByTestId("document-preview");
    await expect(doc).toBeVisible();
    await expect(doc).not.toContainText("PAN");
    await expect(page.getByTestId("customer-pan")).toBeHidden();
  });
});
