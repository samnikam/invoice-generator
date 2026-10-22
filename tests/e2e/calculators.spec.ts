import { expect, test, type Page } from "@playwright/test";

import { expectAllLinksWork, expectNoHorizontalOverflow } from "./helpers";

/* Expected figures in this file are worked out by hand, not taken from the app. */

const CALCULATOR_PATHS = [
  "/calculators/gst",
  "/calculators/reverse-gst",
  "/calculators/discount",
  "/calculators/margin",
  "/calculators/amount-in-words",
];

/** Opens a page and waits until scripts have loaded, so typed input reaches React. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const result = (page: Page, id: string) => page.getByTestId(id);

test.describe("calculators index", () => {
  test("lists all five calculators with working links", async ({ page }) => {
    await open(page, "/calculators");
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(5);
    await expectAllLinksWork(page);
  });

  test("sidebar or menu link opens the calculators", async ({ page }) => {
    await open(page, "/dashboard");
    const menuButton = page.getByRole("button", { name: "Open navigation menu" });
    if (await menuButton.isVisible()) await menuButton.click();
    await page.getByRole("link", { name: "Calculators" }).last().click();
    await expect(page).toHaveURL(/\/calculators$/);
  });
});

test.describe("every calculator page", () => {
  for (const path of CALCULATOR_PATHS) {
    test(`${path}: labelled controls, no sideways scrolling, working links`, async ({ page }) => {
      await open(page, path);
      await expectNoHorizontalOverflow(page);

      // Every visible input and select must have an accessible name (a <label> or aria-label).
      const unlabelled = await page
        .locator("main input:visible, main select:visible")
        .evaluateAll((controls) =>
          controls
            .filter((c) => {
              const el = c as HTMLInputElement;
              return (el.labels?.length ?? 0) === 0 && !el.getAttribute("aria-label");
            })
            .map((c) => c.outerHTML),
        );
      expect(unlabelled).toEqual([]);

      // The current calculator is marked in the tabs.
      await expect(
        page.getByRole("navigation", { name: "Calculators" }).locator('[aria-current="page"]'),
      ).toHaveCount(1);
      await expectAllLinksWork(page);
    });
  }
});

test.describe("GST calculator", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/calculators/gst");
  });

  test("intra-state: ₹10,000 at 18% → CGST ₹900 + SGST ₹900 = ₹11,800", async ({ page }) => {
    await page.getByLabel("Amount before GST").fill("10000");
    await page.getByLabel("Taxable supply").check();
    await page.getByLabel("GST rate", { exact: true }).selectOption("18");
    await page.getByLabel("Seller's state").selectOption("27");
    await page.getByLabel("Place of supply").selectOption("27");

    await expect(result(page, "supply-type")).toHaveText("Intra-state supply (Maharashtra)");
    await expect(result(page, "taxable")).toHaveText("₹10,000.00");
    await expect(result(page, "cgst")).toHaveText("₹900.00");
    await expect(result(page, "sgst")).toHaveText("₹900.00");
    await expect(page.getByText("SGST @ 9%")).toBeVisible();
    await expect(result(page, "igst")).toHaveCount(0);
    await expect(result(page, "total-gst")).toHaveText("₹1,800.00");
    await expect(result(page, "total")).toHaveText("₹11,800.00");
  });

  test("inter-state: ₹2,499.99 at 5% → IGST ₹125.00 = ₹2,624.99", async ({ page }) => {
    await page.getByLabel("Amount before GST").fill("2499.99");
    await page.getByLabel("Taxable supply").check();
    await page.getByLabel("GST rate", { exact: true }).selectOption("5");
    await page.getByLabel("Seller's state").selectOption("27");
    await page.getByLabel("Place of supply").selectOption("29");

    await expect(result(page, "supply-type")).toHaveText("Inter-state supply");
    await expect(result(page, "igst")).toHaveText("₹125.00");
    await expect(result(page, "cgst")).toHaveCount(0);
    await expect(result(page, "total")).toHaveText("₹2,624.99");
  });

  test("UTGST and fractional half-rate labels: Chandigarh at 0.25%", async ({ page }) => {
    await page.getByLabel("Amount before GST").fill("10000");
    await page.getByLabel("Taxable supply").check();
    await page.getByLabel("GST rate", { exact: true }).selectOption("0.25");
    await page.getByLabel("Seller's state").selectOption("04");
    await page.getByLabel("Place of supply").selectOption("04");

    await expect(page.getByText("CGST @ 0.125%")).toBeVisible();
    await expect(page.getByText("UTGST @ 0.125%")).toBeVisible();
    await expect(result(page, "cgst")).toHaveText("₹12.50");
    await expect(result(page, "total")).toHaveText("₹10,025.00");
  });

  test("shows the provisional-rate notice whenever rates are offered", async ({ page }) => {
    await expect(page.getByLabel("GST rate", { exact: true })).toHaveCount(0); // not offered until "taxable"
    await page.getByLabel("Taxable supply").check();
    await expect(page.getByLabel("GST rate", { exact: true })).toBeVisible();
    const notice = page.getByTestId("provisional-rate-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("not been verified");
  });

  test("never assumes states: shows errors and no result when states are missing", async ({
    page,
  }) => {
    await page.getByLabel("Amount before GST").fill("1000");
    await page.getByLabel("Taxable supply").check();
    await page.getByLabel("GST rate", { exact: true }).selectOption("18");
    // Choose and then clear the states, as a user changing their mind would.
    await page.getByLabel("Seller's state").selectOption("27");
    await page.getByLabel("Seller's state").selectOption("");
    await page.getByLabel("Place of supply").selectOption("29");
    await page.getByLabel("Place of supply").selectOption("");

    await expect(page.getByText("Select the seller's state.")).toBeVisible();
    await expect(page.getByText("Select the place of supply.")).toBeVisible();
    await expect(page.getByLabel("Seller's state")).toHaveAttribute("aria-invalid", "true");
    await expect(result(page, "total")).toHaveCount(0);
    await expect(page.getByText("Results appear here once")).toBeVisible();
  });

  test("rejects an invalid amount with a clear message", async ({ page }) => {
    const amount = page.getByLabel("Amount before GST");
    await amount.fill("1,000");
    await amount.blur();
    await expect(page.locator("#gst-amount-error")).toContainText("no commas");
    await expect(amount).toHaveAttribute("aria-invalid", "true");
  });

  test("LUT zero-rating is refused for a domestic supply", async ({ page }) => {
    await page.getByLabel("Amount before GST").fill("1000");
    await page.getByLabel("Zero-rated under LUT/bond").check();
    await page.getByLabel("Seller's state").selectOption("27");
    await page.getByLabel("Place of supply").selectOption("29");
    await expect(page.getByText(/only allowed for exports or supplies to an SEZ/)).toBeVisible();
    await expect(result(page, "total")).toHaveCount(0);
  });

  test("Clear resets the form", async ({ page }) => {
    await page.getByLabel("Amount before GST").fill("1000");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByLabel("Amount before GST")).toHaveValue("");
  });
});

test.describe("Reverse GST calculator", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/calculators/reverse-gst");
  });

  test("shows the provisional-rate notice", async ({ page }) => {
    await expect(page.getByTestId("provisional-rate-notice")).toBeVisible();
    await expect(page.getByText(/already\s+includes GST at the rate you select/)).toBeVisible();
  });

  test("₹1,180 at 18% → ₹1,000.00 before GST + ₹180.00 GST, total only", async ({ page }) => {
    await page.getByLabel("Price including GST").fill("1180");
    await page.getByLabel("GST rate included in the price").selectOption("18");
    await expect(result(page, "amount-before-gst")).toHaveText("₹1,000.00");
    await expect(result(page, "gst-amount")).toHaveText("₹180.00");
    await expect(result(page, "cgst")).toHaveCount(0);
    await expect(result(page, "igst")).toHaveCount(0);
    await expect(result(page, "rounding-note")).toHaveCount(0);
  });

  /*
   * ₹100.00 at 18% (full rate, as IGST) cannot be split exactly into whole paise:
   *   84.74 + 15.25 (84.74 × 18% = 15.2532) = 99.99
   *   84.75 + 15.26 (84.75 × 18% = 15.2550) = 100.01
   * The calculator must show 84.75 + 15.26, show the 100.01 total and the 1-paisa
   * difference, keep the entered ₹100.00 unchanged, and not claim an exact split.
   */
  for (const [label, states] of [
    ["no states (total GST only)", null],
    ["Maharashtra → Karnataka (IGST)", ["27", "29"]],
  ] as const) {
    test(`₹100 at 18%, ${label}: shows the difference instead of an exact split`, async ({
      page,
    }) => {
      await page.getByLabel("Price including GST").fill("100");
      await page.getByLabel("GST rate included in the price").selectOption("18");
      if (states) {
        await page.getByLabel("Seller's state").selectOption(states[0]);
        await page.getByLabel("Place of supply").selectOption(states[1]);
        await expect(result(page, "igst")).toHaveText("₹15.26");
      }

      await expect(result(page, "price")).toHaveText("₹100.00"); // entered price unchanged
      await expect(result(page, "amount-before-gst")).toHaveText("₹84.75");
      await expect(result(page, "gst-amount")).toHaveText("₹15.26");
      await expect(result(page, "computed-total")).toHaveText("₹100.01");

      const note = page.getByRole("note").filter({ hasText: "These figures add up to" });
      await expect(note).toBeVisible();
      await expect(note).toContainText(
        "These figures add up to ₹100.01 — 1 paisa more than the ₹100.00 you entered.",
      );
      await expect(note).toContainText("Your entered price has not been changed.");
      await expect(note).toContainText("no amount before GST adds up to exactly ₹100.00");
      await expect(page.getByLabel("Price including GST")).toHaveValue("100");
    });
  }

  test("an exact split shows no difference row or note", async ({ page }) => {
    await page.getByLabel("Price including GST").fill("1180");
    await page.getByLabel("GST rate included in the price").selectOption("18");
    await expect(result(page, "amount-before-gst")).toHaveText("₹1,000.00");
    await expect(result(page, "computed-total")).toHaveCount(0);
    await expect(result(page, "rounding-note")).toHaveCount(0);
  });

  test("₹100 at 18% intra-state splits exactly into ₹84.74 + ₹7.63 + ₹7.63", async ({ page }) => {
    await page.getByLabel("Price including GST").fill("100");
    await page.getByLabel("GST rate included in the price").selectOption("18");
    await page.getByLabel("Seller's state").selectOption("27");
    await page.getByLabel("Place of supply").selectOption("27");
    await expect(result(page, "amount-before-gst")).toHaveText("₹84.74");
    await expect(result(page, "cgst")).toHaveText("₹7.63");
    await expect(result(page, "sgst")).toHaveText("₹7.63");
    await expect(result(page, "gst-amount")).toHaveText("₹15.26");
    await expect(result(page, "rounding-note")).toHaveCount(0);
  });

  test("asks for the second state when only one is chosen", async ({ page }) => {
    await page.getByLabel("Price including GST").fill("1180");
    await page.getByLabel("GST rate included in the price").selectOption("18");
    await page.getByLabel("Seller's state").selectOption("27");
    await page.getByLabel("Place of supply").selectOption("29");
    await page.getByLabel("Place of supply").selectOption("");
    await expect(page.getByText("Select the place of supply.")).toBeVisible();
    await expect(result(page, "amount-before-gst")).toHaveCount(0);
  });
});

test.describe("Discount calculator", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/calculators/discount");
  });

  test("10% off ₹2,500 → ₹250 off, ₹2,250 final", async ({ page }) => {
    await page.getByLabel("Original price").fill("2500");
    await page.getByLabel("Discount percentage").fill("10");
    await expect(result(page, "original")).toHaveText("₹2,500.00");
    await expect(result(page, "discount")).toHaveText("− ₹250.00");
    await expect(result(page, "final")).toHaveText("₹2,250.00");
  });

  test("fixed ₹150.50 off ₹1,000 → ₹849.50", async ({ page }) => {
    await page.getByLabel("Original price").fill("1000");
    await page.getByLabel("Fixed amount (₹)").check();
    await page.getByLabel("Discount amount").fill("150.50");
    await expect(result(page, "final")).toHaveText("₹849.50");
  });

  test("rejects a discount larger than the price", async ({ page }) => {
    await page.getByLabel("Original price").fill("2500");
    await page.getByLabel("Fixed amount (₹)").check();
    const value = page.getByLabel("Discount amount");
    await value.fill("2600");
    await value.blur();
    await expect(page.getByText("Discount cannot be more than the item's value.")).toBeVisible();
    await expect(result(page, "final")).toHaveCount(0);
  });

  test("rejects a percentage above 100 and too many decimals", async ({ page }) => {
    await page.getByLabel("Original price").fill("2500");
    const value = page.getByLabel("Discount percentage");
    await value.fill("120");
    await value.blur();
    await expect(page.getByText(/cannot be more than 100%/)).toBeVisible();
    await value.fill("12.345");
    await expect(page.getByText(/at most 2 decimal places/)).toBeVisible();
  });
});

test.describe("Margin and markup calculator", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/calculators/margin");
  });

  test("profit: cost ₹800, price ₹1,000 → margin 20%, markup 25%", async ({ page }) => {
    await page.getByLabel("Cost price").fill("800");
    await page.getByLabel("Selling price").fill("1000");
    await expect(page.getByText("Profit", { exact: true })).toBeVisible();
    await expect(result(page, "profit")).toHaveText("₹200.00");
    await expect(result(page, "margin")).toHaveText("20.00%");
    await expect(result(page, "markup")).toHaveText("25.00%");
  });

  test("loss: cost ₹1,000, price ₹800 → loss ₹200, margin −25%, markup −20%", async ({ page }) => {
    await page.getByLabel("Cost price").fill("1000");
    await page.getByLabel("Selling price").fill("800");
    await expect(result(page, "loss-note")).toBeVisible();
    await expect(page.getByText("Loss", { exact: true })).toBeVisible();
    await expect(result(page, "profit")).toHaveText("₹200.00");
    await expect(result(page, "margin")).toHaveText("−25.00%");
    await expect(result(page, "markup")).toHaveText("−20.00%");
  });

  test("zero cost and zero price never show Infinity or NaN", async ({ page }) => {
    await page.getByLabel("Cost price").fill("0");
    await page.getByLabel("Selling price").fill("500");
    await expect(result(page, "markup")).toHaveText("Not defined (cost is ₹0)");
    await expect(result(page, "margin")).toHaveText("100.00%");

    await page.getByLabel("Cost price").fill("500");
    await page.getByLabel("Selling price").fill("0");
    await expect(result(page, "margin")).toHaveText("Not defined (selling price is ₹0)");
    await expect(page.getByRole("main")).not.toContainText(/Infinity|NaN/);
  });

  test("explains that margin and markup differ", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Margin and markup are different" }),
    ).toBeVisible();
  });
});

test.describe("Amount in words", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/calculators/amount-in-words");
  });

  test("₹1,25,000.50 in words", async ({ page }) => {
    await page.getByLabel("Amount in rupees").fill("125000.50");
    await expect(result(page, "formatted-amount")).toHaveText("₹1,25,000.50");
    await expect(result(page, "words")).toHaveText(
      "Rupees One Lakh Twenty-Five Thousand and Fifty Paise Only",
    );
  });

  test("copy button copies the words and announces it", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-specific");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByLabel("Amount in rupees").fill("10000000");
    await page.getByRole("button", { name: "Copy words" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Copied to clipboard." }),
    ).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe("Rupees One Crore Only");
  });

  const invalid: [string, RegExp][] = [
    ["abc", /must be a number/],
    ["-5", /cannot be negative/],
    ["1.234", /at most 2 decimal places/],
    ["1000000000000", /maximum supported amount/],
  ];
  for (const [input, message] of invalid) {
    test(`rejects ${JSON.stringify(input)} with a clear message`, async ({ page }) => {
      const amount = page.getByLabel("Amount in rupees");
      await amount.fill(input);
      await expect(page.getByText(message)).toBeVisible();
      await expect(amount).toHaveAttribute("aria-invalid", "true");
      await expect(result(page, "words")).toHaveCount(0);
    });
  }
});
