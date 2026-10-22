import { expect, test } from "@playwright/test";

// Smoke test: proves the production build starts and serves the home page.
test("home page loads with the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/SmartBill/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "SmartBill" })).toBeVisible();
});
