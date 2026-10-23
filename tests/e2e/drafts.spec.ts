import { expect, test, type Page } from "@playwright/test";

/*
 * Browser-local draft saving (opt-in). Each Playwright test gets a fresh browser
 * context, so localStorage starts empty in every test.
 */

const KEYS = {
  invoice: "smartbill.draft.v1.invoice",
  quotation: "smartbill.draft.v1.quotation",
  receipt: "smartbill.draft.v1.receipt",
} as const;

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function draftKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("smartbill.draft."))
      .sort(),
  );
}

async function stored(page: Page, key: string) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw === null
      ? null
      : (JSON.parse(raw) as { version: number; kind: string; values: Record<string, unknown> });
  }, key);
}

const toggle = (page: Page) => page.getByLabel("Save draft in this browser");
const status = (page: Page) => page.getByTestId("draft-status");

test.describe("draft saving", () => {
  test("is off by default and writes nothing before opt-in", async ({ page }) => {
    await open(page, "/invoices/new");
    await expect(toggle(page)).not.toBeChecked();
    await expect(page.getByText(/not uploaded and not encrypted/)).toBeVisible();
    await page.getByLabel("Business name").fill("Private Business Name");
    await page.getByLabel("Customer name").fill("Private Customer");
    await page.waitForTimeout(1200); // longer than the save delay
    expect(await draftKeys(page)).toEqual([]);
  });

  test("makes no storage write of any kind before opt-in, on any generator", async ({ page }) => {
    // Record every localStorage write the page makes.
    await page.addInitScript(() => {
      const writes: string[] = [];
      (window as unknown as { __writes: string[] }).__writes = writes;
      const setItem = Storage.prototype.setItem;
      const removeItem = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        writes.push(`set:${key}`);
        return setItem.call(this, key, value);
      };
      Storage.prototype.removeItem = function (key: string) {
        writes.push(`remove:${key}`);
        return removeItem.call(this, key);
      };
    });
    const writes = () =>
      page.evaluate(() => (window as unknown as { __writes: string[] }).__writes);

    for (const path of ["/invoices/new", "/quotations/new", "/receipts/new"]) {
      await open(page, path);
      await page.getByLabel("Business name").fill("Private Business Name");
      await page.waitForTimeout(1000);
      expect(await writes(), path).toEqual([]);
    }

    // The first write happens only when the user opts in, and only to that type's key.
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");
    expect(await writes()).toEqual([`set:${KEYS.receipt}`]);
  });

  test("Clear form with saving on says the draft will be replaced, then saves the empty form", async ({
    page,
  }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Before clearing");

    // With saving off, the message does not mention a draft.
    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Clear form" }).click();
    expect(message).toBe("Clear all invoice details? This cannot be undone.");

    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");

    // Cancelling keeps both the form and the draft.
    page.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Clear form" }).click();
    expect(message).toContain(
      "the draft saved in this browser will also be replaced with the empty form",
    );
    await expect(page.getByLabel("Business name")).toHaveValue("Before clearing");
    expect((await stored(page, KEYS.invoice))?.values.seller).toMatchObject({
      name: "Before clearing",
    });

    // Accepting clears the form and replaces the draft; saving stays on.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Clear form" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("");
    await expect(toggle(page)).toBeChecked();
    await expect
      .poll(async () => (await stored(page, KEYS.invoice))?.values.seller)
      .toMatchObject({ name: "" });
  });

  test("two tabs editing the same type: the last save wins", async ({ context }) => {
    const first = await context.newPage();
    await open(first, "/quotations/new");
    await first.getByLabel("Business name").fill("From tab one");
    await toggle(first).check();
    await expect(status(first)).toContainText("Saved");

    const second = await context.newPage();
    await open(second, "/quotations/new");
    await expect(second.getByLabel("Business name")).toHaveValue("From tab one");
    await second.getByLabel("Business name").fill("From tab two");
    await expect
      .poll(async () => (await stored(second, KEYS.quotation))?.values.seller)
      .toMatchObject({ name: "From tab two" });

    // Tab one does not change on screen (tabs are not synchronised)…
    await expect(first.getByLabel("Business name")).toHaveValue("From tab one");
    // …and its next save overwrites tab two's.
    await first.getByLabel("Business name").fill("From tab one, edited later");
    await expect
      .poll(async () => (await stored(first, KEYS.quotation))?.values.seller)
      .toMatchObject({ name: "From tab one, edited later" });
  });

  test("opt-in saves the invoice draft, auto-saves changes, and restores it after reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await open(page, "/invoices/new");
    await page.getByRole("radio", { name: /^Tax invoice/ }).check();
    await page.getByLabel("Business name").fill("Sample Design Studio");
    await page.getByTestId("line-item").first().getByLabel("Unit price").fill("1250.50");

    await toggle(page).check();
    await expect(status(page)).toContainText("Saved in this browser at");
    const first = await stored(page, KEYS.invoice);
    expect(first).toMatchObject({ version: 1, kind: "invoice" });
    expect(first?.values).toMatchObject({
      gstMode: "with-gst",
      seller: { name: "Sample Design Studio" },
    });

    // Later edits are saved automatically after a short pause.
    await page.getByLabel("Customer name").fill("Example Retail Pvt Ltd");
    await expect(status(page)).toContainText("Saved in this browser at");
    await expect
      .poll(async () => (await stored(page, KEYS.invoice))?.values.customer)
      .toMatchObject({ name: "Example Retail Pvt Ltd" });
    expect(await draftKeys(page)).toEqual([KEYS.invoice]);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(toggle(page)).toBeChecked();
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByLabel("Customer name")).toHaveValue("Example Retail Pvt Ltd");
    await expect(page.getByRole("radio", { name: /^Tax invoice/ })).toBeChecked();
    // Entered amounts come back exactly as typed.
    await expect(page.getByTestId("line-item").first().getByLabel("Unit price")).toHaveValue(
      "1250.50",
    );
    await expect(status(page)).toContainText("Saved in this browser at");
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  test("restored line items keep working: adding an item after restore", async ({ page }) => {
    await open(page, "/quotations/new");
    await page.getByTestId("line-item").first().getByLabel("Description").fill("First");
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByTestId("line-item").nth(1).getByLabel("Description").fill("Second");
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("line-item")).toHaveCount(2);
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByTestId("line-item").nth(2).getByLabel("Description").fill("Third");
    const descriptions = page.getByTestId("line-item").getByLabel("Description");
    await expect(descriptions).toHaveCount(3);
    await expect(descriptions.nth(0)).toHaveValue("First");
    await expect(descriptions.nth(1)).toHaveValue("Second");
    await expect(descriptions.nth(2)).toHaveValue("Third");
  });

  test("invoice, quotation and receipt drafts are stored separately", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Invoice Business");
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");

    await open(page, "/receipts/new");
    await expect(toggle(page)).not.toBeChecked();
    await expect(page.getByLabel("Business name")).toHaveValue("");
    await page.getByLabel("Business name").fill("Receipt Business");
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");

    await open(page, "/quotations/new");
    await expect(toggle(page)).not.toBeChecked();
    await expect(page.getByLabel("Business name")).toHaveValue("");

    expect(await draftKeys(page)).toEqual([KEYS.invoice, KEYS.receipt]);
    expect((await stored(page, KEYS.invoice))?.values.seller).toMatchObject({
      name: "Invoice Business",
    });
    expect((await stored(page, KEYS.receipt))?.values.business).toMatchObject({
      name: "Receipt Business",
    });

    await open(page, "/invoices/new");
    await expect(page.getByLabel("Business name")).toHaveValue("Invoice Business");
  });

  test("turning saving off asks first, then deletes only that draft", async ({ page }) => {
    await open(page, "/receipts/new");
    await page.getByLabel("Business name").fill("Receipt Business");
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Invoice Business");
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");

    // Cancel: nothing changes (click, because the checkbox correctly stays ticked).
    page.once("dialog", (d) => d.dismiss());
    await toggle(page).click();
    await expect(toggle(page)).toBeChecked();
    expect(await draftKeys(page)).toEqual([KEYS.invoice, KEYS.receipt]);

    // Confirm: only the invoice draft is removed; the form keeps its values.
    page.once("dialog", (d) => d.accept());
    await toggle(page).uncheck();
    await expect(toggle(page)).not.toBeChecked();
    expect(await draftKeys(page)).toEqual([KEYS.receipt]);
    await expect(page.getByLabel("Business name")).toHaveValue("Invoice Business");

    // And nothing is written again while saving is off.
    await page.getByLabel("Business name").fill("Changed");
    await page.waitForTimeout(1200);
    expect(await draftKeys(page)).toEqual([KEYS.receipt]);
  });

  test("a failed deletion keeps saving on and says the draft may still be stored", async ({
    page,
  }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Keep me");
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");

    // From now on the browser refuses deletions.
    await page.evaluate(() => {
      Storage.prototype.removeItem = function () {
        throw new DOMException("denied", "SecurityError");
      };
    });
    page.once("dialog", (d) => d.accept());
    await toggle(page).click(); // click: the checkbox correctly stays ticked
    await expect(status(page)).toContainText(
      "Could not delete the draft: this browser is blocking storage. The draft may still be stored in this browser, so saving is still on.",
    );
    await expect(toggle(page)).toBeChecked();
    await expect(page.getByLabel("Business name")).toHaveValue("Keep me");
    expect((await stored(page, KEYS.invoice))?.values.seller).toMatchObject({ name: "Keep me" });
  });

  test("a damaged draft is not loaded, does not break the page, and can be replaced", async ({
    page,
  }) => {
    await open(page, "/invoices/new");
    await page.evaluate((key) => localStorage.setItem(key, "{not valid json"), KEYS.invoice);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("draft-notice")).toContainText("could not be read");
    await expect(toggle(page)).not.toBeChecked();
    await expect(page.getByLabel("Business name")).toHaveValue("");
    await page.getByLabel("Business name").fill("Fresh start");
    await toggle(page).check();
    await expect(status(page)).toContainText("Saved");
    expect((await stored(page, KEYS.invoice))?.values.seller).toMatchObject({
      name: "Fresh start",
    });
  });

  test("a draft with the wrong shape is rejected safely", async ({ page }) => {
    await open(page, "/receipts/new");
    await page.evaluate(
      (key) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            kind: "receipt",
            savedAt: new Date().toISOString(),
            values: { amount: 500, method: "crypto" },
          }),
        ),
      KEYS.receipt,
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("draft-notice")).toBeVisible();
    await expect(page.getByLabel("Amount received")).toHaveValue("");
  });

  test("full browser storage gives a helpful message", async ({ page }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key.startsWith("smartbill.draft.v1.")) {
          throw new DOMException("Storage full", "QuotaExceededError");
        }
        return original.call(this, key, value);
      };
    });
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Too big");
    // click, because the checkbox correctly stays unticked when saving fails.
    await toggle(page).click();
    await expect(status(page)).toContainText("storage is full");
    await expect(toggle(page)).not.toBeChecked();
    await expect(page.getByLabel("Business name")).toHaveValue("Too big");
  });

  test("blocked browser storage disables the option with an explanation", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Access denied", "SecurityError");
        },
      });
    });
    await open(page, "/receipts/new");
    await expect(toggle(page)).toBeDisabled();
    await expect(status(page)).toContainText("blocking storage");
    // The rest of the page still works.
    await page.getByLabel("Amount received").fill("100");
    await expect(page.getByTestId("form-amount-in-words")).toHaveText("Rupees One Hundred Only");
  });

  test("the draft panel is not printed", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.emulateMedia({ media: "print" });
    await expect(toggle(page)).toBeHidden();
  });
});
