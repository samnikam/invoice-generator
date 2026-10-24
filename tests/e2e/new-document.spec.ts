import { expect, test, type Page } from "@playwright/test";

/*
 * "New …" / "Create …" actions start a fresh form. Next.js keeps visited pages alive
 * (Cache Components), so without this an earlier form would reappear. Unfinished work is
 * never cleared without asking, and ordinary navigation still keeps it.
 */

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function chooseNew(page: Page, item: RegExp) {
  await page.getByRole("banner").getByRole("button", { name: "New" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

const workspaceNav = async (page: Page) => {
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  if (await menu.isVisible()) {
    // The phone/tablet menu slides shut after a link is chosen; reopen it only once closed.
    await expect(page.getByRole("dialog")).toBeHidden();
    await menu.click();
  }
  return page.getByRole("navigation", { name: "Workspace" });
};

/** Answers the next confirmation dialog and records its message. */
function answerNextDialog(page: Page, accept: boolean): { message: string } {
  const seen = { message: "" };
  page.once("dialog", (dialog) => {
    seen.message = dialog.message();
    void (accept ? dialog.accept() : dialog.dismiss());
  });
  return seen;
}

test.describe("New invoice from the top bar", () => {
  test("an untouched form is left as it is, without asking", async ({ page }) => {
    await open(page, "/invoices/new");
    let asked = false;
    page.on("dialog", (d) => {
      asked = true;
      void d.dismiss();
    });
    await chooseNew(page, /New invoice/);
    await expect(page.getByLabel("Customer name")).toHaveValue("");
    expect(asked).toBe(false);
  });

  test("on the same page: asks first; Cancel keeps the details, OK starts fresh", async ({
    page,
  }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Customer name").fill("Earlier Customer");
    await page.getByLabel("Invoice number").fill("INV-OLD-1");

    const cancelled = answerNextDialog(page, false);
    await chooseNew(page, /New invoice/);
    await expect.poll(() => cancelled.message).toContain("Start a new invoice?");
    await expect(page.getByLabel("Customer name")).toHaveValue("Earlier Customer");

    answerNextDialog(page, true);
    await chooseNew(page, /New invoice/);
    await expect(page.getByLabel("Customer name")).toHaveValue("");
    await expect(page.getByLabel("Invoice number")).toHaveValue("");
    await expect(page.getByLabel("Invoice date")).not.toHaveValue("");
  });

  test("after visiting another page, New invoice starts fresh (with the saved business details)", async ({
    page,
  }) => {
    await open(page, "/settings/business");
    await page.getByLabel("Business name").fill("Sample Design Studio");
    await page.getByLabel("Business address").fill("12 MG Road\nPune");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("profile-status")).toContainText("Saved in this browser");

    await open(page, "/invoices/new");
    await page.getByLabel("Business name").fill("Changed For This Invoice");
    await page.getByLabel("Customer name").fill("Earlier Customer");
    await (await workspaceNav(page)).getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    answerNextDialog(page, true);
    await chooseNew(page, /New invoice/);
    await expect(page).toHaveURL(/\/invoices\/new$/);
    await expect(page.getByLabel("Customer name")).toHaveValue("");
    await expect(page.getByLabel("Business name")).toHaveValue("Sample Design Studio");
    await expect(page.getByTestId("filled-from-profile")).toBeVisible();
  });

  test("ordinary navigation away and back keeps unfinished work", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Customer name").fill("Keep Me");
    await (await workspaceNav(page)).getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Come back with another ordinary link: the dashboard's "Open" on the invoices card.
    await page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ hasText: "GST invoices" })
      .getByRole("link", { name: "Open" })
      .click();
    await expect(page).toHaveURL(/\/invoices\/new$/);
    await expect(page.getByLabel("Customer name")).toHaveValue("Keep Me");
  });

  test("with draft saving on, the warning says so and the draft becomes the new form", async ({
    page,
  }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Save draft in this browser").click();
    await page.getByLabel("Customer name").fill("Draft Customer");
    await expect(page.getByTestId("draft-status")).toContainText("Saved in this browser");

    const asked = answerNextDialog(page, true);
    await chooseNew(page, /New invoice/);
    await expect.poll(() => asked.message).toContain("Draft saving is on");
    await expect(page.getByLabel("Customer name")).toHaveValue("");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("smartbill.draft.v1.invoice") ?? "null")?.values
              ?.customer?.name,
        ),
      )
      .toBe("");
  });
});

test.describe("New quotation and New receipt", () => {
  test("New quotation starts fresh after leaving the page", async ({ page }) => {
    await open(page, "/quotations/new");
    await page.getByLabel("Customer name").fill("Earlier Quote Customer");
    await (await workspaceNav(page)).getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    answerNextDialog(page, true);
    await chooseNew(page, /New quotation/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("New quotation");
    await expect(page.getByLabel("Customer name")).toHaveValue("");
  });

  test("New receipt on the same page starts fresh after confirming", async ({ page }) => {
    await open(page, "/receipts/new");
    await page.getByLabel("Payer name").fill("Earlier Payer");
    await page.getByLabel("Amount received").fill("500");
    const asked = answerNextDialog(page, true);
    await chooseNew(page, /New receipt/);
    await expect.poll(() => asked.message).toContain("Start a new receipt?");
    await expect(page.getByLabel("Payer name")).toHaveValue("");
    await expect(page.getByLabel("Amount received")).toHaveValue("");
  });

  test("the dashboard's Create invoice button also starts fresh", async ({ page }) => {
    await open(page, "/invoices/new");
    await page.getByLabel("Customer name").fill("Earlier Customer");
    await (await workspaceNav(page)).getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    answerNextDialog(page, true);
    await page.getByRole("link", { name: "Create invoice" }).click();
    await expect(page).toHaveURL(/\/invoices\/new$/);
    await expect(page.getByLabel("Customer name")).toHaveValue("");
  });
});
