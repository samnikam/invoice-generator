import { expect, test } from "@playwright/test";

import { expectAllLinksWork, expectNoHorizontalOverflow, MD, viewportWidth } from "./helpers";

test.describe("landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the main sections", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("invoices");
    for (const id of ["benefits", "features", "how-it-works"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.getByRole("contentinfo")).toContainText("not government-certified");
  });

  test("labels the invoice preview as sample data", async ({ page }) => {
    await expect(page.getByText(/Illustrative example with sample data/)).toBeVisible();
    await expect(page.getByText("₹27,140.00")).toBeVisible();
  });

  test("marks unfinished features as in development and links available ones", async ({ page }) => {
    const featureSection = page.locator("#features");
    await expect(featureSection.getByText("In development")).toHaveCount(2);
    await expect(featureSection.getByRole("link", { name: "Open invoices" })).toHaveAttribute(
      "href",
      "/invoices/new",
    );
    await featureSection.getByRole("link", { name: "Open calculators" }).click();
    await expect(page).toHaveURL(/\/calculators$/);
  });

  test("every link has a working destination", async ({ page }) => {
    await expectAllLinksWork(page);
  });

  test("has no horizontal scrolling", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });

  test("primary call to action opens the workspace", async ({ page }) => {
    await page.getByRole("main").getByRole("link", { name: "Open workspace" }).first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome to SmartBill");
  });

  test("secondary call to action jumps to How it works", async ({ page }) => {
    await page.getByRole("link", { name: "See how it works" }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(page.locator("#how-it-works")).toBeInViewport();
  });

  test("skip link moves keyboard users to the content", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
});

test.describe("website navigation", () => {
  test("desktop navigation links are visible on wide screens", async ({ page }) => {
    test.skip(viewportWidth(page) < MD, "desktop-only layout");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Features" }).click();
    await expect(page.locator("#features")).toBeInViewport();
  });

  test("mobile menu opens, navigates, and closes", async ({ page }) => {
    test.skip(viewportWidth(page) >= MD, "mobile-only layout");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await menuButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("link", { name: "How it works" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#how-it-works$/);
  });

  test("mobile menu works with the keyboard", async ({ page }) => {
    test.skip(viewportWidth(page) >= MD, "mobile-only layout");
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await menuButton.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Focus must stay inside the open menu.
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menuButton).toBeFocused();
  });
});
