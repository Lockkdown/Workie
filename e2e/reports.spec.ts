import { expect, test } from "@playwright/test";

test.describe("Reports", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("shows three axes and no primary call to action", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Working time" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Task outcomes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Contribution" }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "Week" })).toBeChecked();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
    await expect(page.getByLabel("Contribution levels")).toBeVisible();
    await expect(page.locator('[data-variant="primary"]')).toHaveCount(0);
    await expect(page.getByText("Missed")).toHaveCount(0);
  });
});
