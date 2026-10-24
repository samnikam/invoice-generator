import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

/*
 * Business profile (browser-local). Each test starts with empty localStorage.
 * 27AAPFU0939F1ZV is the widely published valid example GSTIN (Maharashtra).
 */

const PROFILE_KEY = "smartbill.profile.v1";
const INVOICE_DRAFT = "smartbill.draft.v1.invoice";
const RECEIPT_DRAFT = "smartbill.draft.v1.receipt";

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function storedJson(page: Page, key: string) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
  }, key);
}

async function saveProfile(page: Page, name = "Sample Design Studio") {
  await open(page, "/settings/business");
  await page.getByLabel("Business name").fill(name);
  await page.getByLabel("Business address").fill("12 MG Road\nPune");
  await page.getByLabel("Phone").fill("+91 98765 43210");
  await page.getByLabel("Email").fill("hello@example.com");
  await page.getByLabel("GSTIN").fill("27aapfu0939f1zv");
  await page.getByLabel("State of registration").selectOption("27");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");
}

async function showPreview(page: Page, noun: string) {
  const toggle = page.getByRole("button", { name: `Preview ${noun}` });
  if (await toggle.isVisible()) await toggle.click();
}

test.describe("business profile page", () => {
  test("saves only on “Save profile”, normalises the GSTIN, and reloads", async ({ page }) => {
    await page.addInitScript(() => {
      const writes: string[] = [];
      (window as unknown as { __writes: string[] }).__writes = writes;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        writes.push(key);
        return setItem.call(this, key, value);
      };
    });
    await open(page, "/settings/business");
    await expect(page.getByText(/not uploaded and not encrypted/)).toBeVisible();
    await page.getByLabel("Business name").fill("Typed but not saved");
    await page.waitForTimeout(800);
    expect(
      await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes),
    ).toEqual([]);
    await expect(page.getByTestId("profile-status")).toHaveText("You have unsaved changes.");

    await saveProfile(page);
    expect(await storedJson(page, PROFILE_KEY)).toMatchObject({
      version: 1,
      profile: {
        name: "Sample Design Studio",
        gstin: "27AAPFU0939F1ZV",
        stateCode: "27",
        phone: "+91 98765 43210",
      },
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByLabel("GSTIN")).toHaveValue("27AAPFU0939F1ZV");
    await expect(page.getByLabel("State of registration")).toHaveValue("27");
    await expect(page.getByRole("button", { name: "Delete profile" })).toBeVisible();
  });

  test("checks the GSTIN against the state and offers the right state", async ({ page }) => {
    await open(page, "/settings/business");
    await page.getByLabel("Business name").fill("Sample");
    await page.getByLabel("GSTIN").fill("27AAPFU0939F1ZV");
    await page.getByLabel("State of registration").selectOption("29");
    await expect(
      page.getByText(
        /registered in Maharashtra \(27\), but the state selected is Karnataka \(29\)/,
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Use Maharashtra (27) from the GSTIN" }).click();
    await expect(page.getByLabel("State of registration")).toHaveValue("27");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");
  });

  test("an invalid profile is not saved; the error summary takes focus", async ({ page }) => {
    await open(page, "/settings/business");
    await page.getByLabel("GSTIN").fill("27AAPFU0939F1ZA");
    await page.getByRole("button", { name: "Save profile" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "before saving" });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link", { name: "Business name" })).toBeVisible();
    await expect(summary.getByRole("link", { name: "GSTIN" })).toBeVisible();
    expect(await storedJson(page, PROFILE_KEY)).toBeNull();
  });

  test("delete asks first and removes only the profile", async ({ page }) => {
    await saveProfile(page);
    await page.evaluate((key) => localStorage.setItem(key, "draft-data"), INVOICE_DRAFT);

    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Delete profile" }).click();
    expect(await storedJson(page, PROFILE_KEY)).not.toBeNull();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete profile" }).click();
    await expect(page.getByTestId("profile-status")).toHaveText(
      "Business profile deleted from this browser.",
    );
    await expect(page.getByLabel("Business name")).toHaveValue("");
    expect(await storedJson(page, PROFILE_KEY)).toBeNull();
    expect(await page.evaluate((k) => localStorage.getItem(k), INVOICE_DRAFT)).toBe("draft-data");
  });

  test("a failed deletion is reported honestly and keeps the form", async ({ page }) => {
    await saveProfile(page);
    await page.evaluate(() => {
      Storage.prototype.removeItem = function () {
        throw new DOMException("denied", "SecurityError");
      };
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete profile" }).click();
    await expect(page.getByTestId("profile-status")).toHaveText(
      "Could not delete the profile: this browser is blocking storage. It is still saved here.",
    );
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByLabel("GSTIN")).toHaveValue("27AAPFU0939F1ZV");
    expect(await storedJson(page, PROFILE_KEY)).toMatchObject({
      profile: { name: "Sample Design Studio" },
    });
    await expect(page.getByRole("button", { name: "Delete profile" })).toBeVisible();
  });

  test("labelled controls and no sideways scrolling", async ({ page }) => {
    await open(page, "/settings/business");
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
  });
});

test.describe("documents filled from the profile", () => {
  test("new invoice: every business field is filled, and it prints", async ({ page }) => {
    await saveProfile(page);
    await open(page, "/invoices/new");
    await expect(page.getByTestId("filled-from-profile")).toBeVisible();
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByLabel("Business address")).toHaveValue("12 MG Road\nPune");
    await page.getByLabel("Tax invoice").check();
    await expect(page.getByLabel("State of registration")).toHaveValue("27");
    await expect(page.getByLabel(/^GSTIN/)).toHaveValue("27AAPFU0939F1ZV");
    // Nothing is stored for the invoice itself (draft saving is still off).
    expect(await storedJson(page, INVOICE_DRAFT)).toBeNull();

    await page.emulateMedia({ media: "print" });
    const doc = page.getByTestId("document-preview");
    await expect(doc).toBeVisible();
    await expect(doc).toContainText("Sample Design Studio");
    await expect(doc).toContainText("27AAPFU0939F1ZV");
    await expect(doc).toContainText("Maharashtra (27)");
  });

  test("new quotation is filled too", async ({ page }) => {
    await saveProfile(page);
    await open(page, "/quotations/new");
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByLabel("Email").first()).toHaveValue("hello@example.com");
  });

  test("new receipt gets contact details only — never GSTIN or state", async ({ page }) => {
    await saveProfile(page);
    await open(page, "/receipts/new");
    await expect(page.getByTestId("filled-from-profile")).toBeVisible();
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByRole("textbox", { name: /^Address/ }).first()).toHaveValue(
      "12 MG Road\nPune",
    );
    await expect(page.getByLabel(/GSTIN/)).toHaveCount(0);
    await expect(page.getByLabel(/State of registration/)).toHaveCount(0);

    await showPreview(page, "receipt");
    const doc = page.getByTestId("receipt-preview");
    await expect(doc).toContainText("Sample Design Studio");
    await expect(doc).not.toContainText("27AAPFU0939F1ZV");
    await expect(doc).not.toContainText(/GSTIN/i);

    // Even when the receipt is saved as a draft, it holds no GSTIN or state.
    await page.getByLabel("Save draft in this browser").check();
    await expect(page.getByTestId("draft-status")).toContainText("Saved");
    const draft = await storedJson(page, RECEIPT_DRAFT);
    expect(Object.keys((draft?.values as { business: object }).business).sort()).toEqual([
      "address",
      "email",
      "name",
      "phone",
    ]);
  });

  test("without a profile, documents start empty and link to set one up", async ({ page }) => {
    await open(page, "/invoices/new");
    await expect(page.getByLabel("Business name")).toHaveValue("");
    await expect(page.getByTestId("filled-from-profile")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Set up business profile" })).toHaveAttribute(
      "href",
      "/settings/business",
    );
    await expect(page.getByRole("button", { name: "Use saved business details" })).toHaveCount(0);
  });
});

test.describe("drafts take priority over the profile", () => {
  test("a saved draft is restored exactly, and profile changes never alter it", async ({
    page,
  }) => {
    // 1. A draft exists first.
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Draft Business");
    await page.getByLabel("Customer name").fill("Draft Customer");
    await page.getByLabel("Save draft in this browser").check();
    await expect(page.getByTestId("draft-status")).toContainText("Saved");
    const draftBefore = await page.evaluate((k) => localStorage.getItem(k), INVOICE_DRAFT);

    // 2. A profile is saved afterwards.
    await saveProfile(page, "Profile Business");
    expect(await page.evaluate((k) => localStorage.getItem(k), INVOICE_DRAFT)).toBe(draftBefore);

    // 3. The invoice reopens with the draft, not the profile.
    await open(page, "/invoices/new");
    await expect(page.getByLabel("Business name")).toHaveValue("Draft Business");
    await expect(page.getByTestId("filled-from-profile")).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(await page.evaluate((k) => localStorage.getItem(k), INVOICE_DRAFT)).toBe(draftBefore);
  });

  test("“Use saved business details” asks first and replaces only business fields", async ({
    page,
  }) => {
    await saveProfile(page);
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Edited For This Invoice");
    await page.getByLabel("Customer name").fill("Kept Customer");
    await page.getByLabel("Invoice number").fill("INV-KEEP-1");
    await page.getByTestId("line-item").first().getByLabel("Description").fill("Kept item");
    await page.getByTestId("line-item").first().getByLabel("Unit price").fill("999.99");

    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Use saved business details" }).click();
    // The dialog handler runs asynchronously, so wait for it to record the message.
    await expect
      .poll(() => message)
      .toContain("Replace the business name, address, phone, email, GSTIN and state");
    expect(message).toContain("Customer, items and other details are not changed");
    await expect(page.getByLabel("Business name")).toHaveValue("Edited For This Invoice");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Use saved business details" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByLabel("Phone").first()).toHaveValue("+91 98765 43210");
    await expect(page.getByLabel("Customer name")).toHaveValue("Kept Customer");
    await expect(page.getByLabel("Invoice number")).toHaveValue("INV-KEEP-1");
    await expect(page.getByTestId("line-item").first().getByLabel("Description")).toHaveValue(
      "Kept item",
    );
    await expect(page.getByTestId("line-item").first().getByLabel("Unit price")).toHaveValue(
      "999.99",
    );
  });

  test("on a receipt the button never adds GSTIN or state", async ({ page }) => {
    await saveProfile(page);
    await open(page, "/receipts/new");
    await page.getByLabel("Business name").fill("Changed");
    await page.getByLabel("Amount received").fill("500");
    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.accept();
    });
    await page.getByRole("button", { name: "Use saved business details" }).click();
    // Wait until the real message is recorded, so the GSTIN check below cannot pass
    // against an empty message.
    await expect.poll(() => message).toContain("name, address, phone and email");
    expect(message).not.toContain("GSTIN");
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByLabel("Amount received")).toHaveValue("500");
  });
});

test.describe("profile storage problems", () => {
  test("a damaged profile is not loaded and breaks nothing", async ({ page }) => {
    await open(page, "/settings/business");
    await page.evaluate((key) => localStorage.setItem(key, "{damaged"), PROFILE_KEY);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("profile-notice")).toContainText("could not be read");
    await expect(page.getByLabel("Business name")).toHaveValue("");

    await open(page, "/invoices/new");
    await expect(page.getByLabel("Business name")).toHaveValue("");
    await expect(page.getByTestId("filled-from-profile")).toHaveCount(0);
    await page.getByLabel("Business name").fill("Still works");
    await expect(page.getByLabel("Business name")).toHaveValue("Still works");
  });

  test("full storage keeps the typed details and explains the problem", async ({ page }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === "smartbill.profile.v1") throw new DOMException("full", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
    });
    await open(page, "/settings/business");
    await page.getByLabel("Business name").fill("Too much");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("storage is full");
    await expect(page.getByLabel("Business name")).toHaveValue("Too much");
  });

  test("blocked storage disables saving with an explanation; documents still work", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("denied", "SecurityError");
        },
      });
    });
    await open(page, "/settings/business");
    await expect(page.getByText(/blocking storage/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save profile" })).toBeDisabled();
    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Works anyway");
    await expect(page.getByLabel("Business name")).toHaveValue("Works anyway");
  });
});

test.describe("navigation", () => {
  test("dashboard prompt appears until a profile is saved", async ({ page }) => {
    await open(page, "/dashboard");
    const prompt = page.getByTestId("profile-prompt");
    await expect(prompt).toBeVisible();
    await prompt.getByRole("link", { name: "Set up profile" }).click();
    await expect(page).toHaveURL(/\/settings\/business$/);
    await saveProfile(page);
    await open(page, "/dashboard");
    await expect(page.getByTestId("profile-prompt")).toHaveCount(0);
  });

  test("the Settings group links to the business profile", async ({ page }) => {
    await open(page, "/dashboard");
    const menu = page.getByRole("button", { name: "Open navigation menu" });
    if (await menu.isVisible()) await menu.click();
    const link = page.getByRole("link", { name: "Business profile" }).last();
    await expect(link).toHaveAttribute("href", "/settings/business");
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business profile");
  });
});
