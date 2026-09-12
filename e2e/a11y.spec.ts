import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
] as const;

const DESTINATIONS = ["Daily Desk", "Plan Tomorrow", "Reports"] as const;

test.describe("bypass and destinations [D81] [D92]", () => {
  test("skip link is first and moves focus to main", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    const firstName = await page.evaluate(() => {
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.tabIndex >= 0);
      return nodes[0]?.textContent?.trim() ?? "";
    });
    expect(firstName).toBe("Skip to main content");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await skip.focus();
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}x${viewport.height} destinations`, () => {
    test.use({ viewport });

    test("has no horizontal page scrolling on Daily Desk, Plan Tomorrow, or Reports", async ({
      page,
    }) => {
      await page.goto("/");
      for (const name of DESTINATIONS) {
        await page
          .getByRole("navigation", { name: "App" })
          .getByRole("button", { name })
          .click();
        await expect(page.getByRole("heading", { name })).toBeVisible();
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      }
    });
  });
}

test.describe("reduced motion [D89]", () => {
  test.use({ reducedMotion: "reduce" });

  test("collapses ritual duration tokens", async ({ page }) => {
    await page.goto("/");
    const ritual = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--duration-ritual")
        .trim(),
    );
    expect(["0ms", "0s"]).toContain(ritual);
    await page.getByRole("button", { name: "Plan Tomorrow" }).click();
    await expect(
      page.getByRole("heading", { name: "Plan Tomorrow" }),
    ).toBeVisible();
  });
});

test.describe("high contrast [D92]", () => {
  test.use({ forcedColors: "active" });

  test("keeps destination names and skip link", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Daily Desk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Plan Tomorrow" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reports" })).toBeVisible();
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.locator('[data-variant="primary"]')).toHaveCount(0);
  });
});

test.describe("muted Now rail [D90]", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("sound stays optional and events stay readable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Now" })).toBeVisible();
    await expect(
      page.getByText("Events stay readable while muted."),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Play sound" }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: "Preview sound" }),
    ).toBeVisible();
  });
});

test.describe("offline planning draft [D23] [D91]", () => {
  test("Plan Tomorrow shows label, icon, and save state when offline", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Plan Tomorrow" }).click();
    await expect(
      page.getByRole("heading", { name: "Plan Tomorrow" }),
    ).toBeVisible();
    await page.context().setOffline(true);
    const banner = page.locator('[data-offline="true"]');
    await expect(banner).toBeVisible();
    await expect(banner.locator('[data-icon="offline"]')).toBeVisible();
    await expect(banner.getByText("Offline")).toBeVisible();
    await expect(banner.getByText("Draft saved on this device")).toBeVisible();
  });
});

test.describe("identity [D94]", () => {
  test("Daily Desk carries display type and chamfered shell", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("h1.type-display-xl")).toHaveText("Workie");
    await expect(page.locator("header.app-chrome.ui-ornament")).toBeVisible();
    await expect(page.locator('[data-primary-slot="daily-desk"]')).toHaveCount(
      1,
    );
  });
});
