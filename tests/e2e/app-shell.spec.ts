import { expect, test } from "@playwright/test";

import { expectAllLinksWork, expectNoHorizontalOverflow, LG, viewportWidth } from "./helpers";

test.describe("workspace shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("dashboard shows honest tool status with no fake data", async ({ page }) => {
    await expect(page).toHaveTitle(/Dashboard \| SmartBill/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome to SmartBill");
    await expect(page.getByRole("status")).toContainText("3 tools are still being built");
    await expect(page.getByRole("main").getByText("In development", { exact: true })).toHaveCount(
      3,
    );
    await expect(page.getByRole("main").getByText("Available", { exact: true })).toHaveCount(1);
  });

  test("dashboard opens the calculators", async ({ page }) => {
    await page.getByRole("main").getByRole("link", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/calculators$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business calculators");
  });

  test("every link has a working destination", async ({ page }) => {
    await expectAllLinksWork(page);
  });

  test("has no horizontal scrolling", async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });

  test("sidebar highlights the current page and does not link unfinished tools", async ({
    page,
  }) => {
    test.skip(viewportWidth(page) < LG, "sidebar is desktop-only");
    const nav = page.getByRole("navigation", { name: "Workspace" });
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const name of ["Invoices", "Quotations", "Receipts"]) {
      await expect(nav.getByRole("link", { name })).toHaveCount(0);
      await expect(nav.getByText(name)).toBeVisible();
    }
    await expect(nav.getByText("Soon")).toHaveCount(3);
    await expect(nav.getByRole("link", { name: "Calculators" })).toHaveAttribute(
      "href",
      "/calculators",
    );
  });

  test("mobile menu opens, works with the keyboard, and closes", async ({ page }) => {
    test.skip(viewportWidth(page) >= LG, "menu button is for smaller screens");
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeHidden();

    const menuButton = page.getByRole("button", { name: "Open navigation menu" });
    await menuButton.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menuButton).toBeFocused();

    // Choosing a link closes the menu.
    await menuButton.click();
    await dialog.getByRole("link", { name: "Dashboard" }).click();
    await expect(dialog).toBeHidden();
  });

  test("website link returns to the landing page", async ({ page }) => {
    await page
      .getByRole("banner")
      .getByRole("link", { name: /Website/ })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test("unknown pages show a helpful 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go to home page" }).click();
  await expect(page).toHaveURL(/\/$/);
});
