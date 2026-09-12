import { expect, test } from "@playwright/test";

test.describe("Task Board", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("opens from the Daily Desk tray with four columns", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open Task Board" }).click();
    await expect(page.getByRole("heading", { name: "Waiting" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "In Progress" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deferred" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Closed" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Completed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Abandoned" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cancelled" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "More actions" }),
    ).toHaveCount(0);
  });

  test("creates a Waiting unscheduled task from the form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open Task Board" }).click();
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByLabel("Title").fill("Viết spec");
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByText("Viết spec")).toBeVisible();
    await expect(page.locator('[data-signal="schedule"]')).toHaveText(
      "Unscheduled",
    );
    await expect(page.getByText("Waiting").first()).toBeVisible();
    await expect(page.getByText("More actions")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to day plan" }),
    ).toBeVisible();
  });
});
