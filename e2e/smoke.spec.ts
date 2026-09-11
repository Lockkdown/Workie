import { expect, test } from "@playwright/test";

test.describe("scaffold smoke", () => {
  test("keyboard, single pointer, theme, and reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    await expect(page.getByTestId("user-content")).toHaveText("Việc cần làm");
  });

  test("Inter renders a Vietnamese user string after fonts load", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const userContent = page.getByTestId("user-content");
    await expect(userContent).toHaveText("Việc cần làm");
    await expect(userContent).toHaveCSS("font-family", /Inter/);
  });
});

test.describe("timezone", () => {
  test.use({ timezoneId: "Asia/Bangkok" });

  test("honours the configured timezone", async ({ page }) => {
    await page.goto("/");
    const timeZone = await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    expect(timeZone).toBe("Asia/Bangkok");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
  });
});
