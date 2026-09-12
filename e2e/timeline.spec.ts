import { expect, test } from "@playwright/test";

test.describe("timeline Daily Desk", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("shows the timeline, Open Task Board, and no page horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Day" })).toBeVisible();
    await expect(page.getByTestId("hour-axis")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open Task Board" }),
    ).toBeVisible();
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test("keyboard unschedules and converts a reserve created from the tray", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create reserve" }).click();
    await page.getByRole("button", { name: "Fixed" }).click();
    await page.getByRole("button", { name: "Apply preview" }).click();
    const block = page.locator("[data-block-id]").first();
    await expect(block).toBeVisible();
    await block.click();
    const convert = page.getByRole("button", { name: "Make Flexible" });
    await convert.focus();
    await expect(convert).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Apply preview" }).click();
    await block.click();
    const unschedule = page.getByRole("button", { name: "Unschedule" });
    await unschedule.focus();
    await expect(unschedule).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Apply preview" }).click();
    await expect(page.locator("[data-block-id]")).toHaveCount(0);
  });
});
