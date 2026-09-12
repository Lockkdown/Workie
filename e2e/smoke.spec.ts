import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
] as const;

test.describe("app shell smoke", () => {
  test("keyboard reaches all three destinations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "App" });
    await expect(nav.getByRole("button", { name: "Daily Desk" })).toBeVisible();
    await expect(
      nav.getByRole("button", { name: "Plan Tomorrow" }),
    ).toBeVisible();
    await expect(nav.getByRole("button", { name: "Reports" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Calendar" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Kanban" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Pomodoro" })).toHaveCount(0);

    await nav.getByRole("button", { name: "Plan Tomorrow" }).focus();
    await expect(
      nav.getByRole("button", { name: "Plan Tomorrow" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Plan Tomorrow" }),
    ).toBeVisible();

    await nav.getByRole("button", { name: "Reports" }).focus();
    await expect(nav.getByRole("button", { name: "Reports" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.locator('[data-variant="primary"]')).toHaveCount(0);

    await nav.getByRole("button", { name: "Daily Desk" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();
  });

  test("theme System, Dark, and Light, and Dark survives reload", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
    await expect(page.getByRole("radio", { name: "System" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Light" })).toBeVisible();

    const dark = page.getByRole("radio", { name: "Dark" });
    await dark.focus();
    await expect(dark).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme-persisted",
      "dark",
    );
    await expect(dark).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();

    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("radio", { name: "System" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  });

  test("Inter renders a Vietnamese user string after fonts load", async ({
    page,
  }) => {
    const title = "Họp với khách hàng";
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open Task Board" }).click();
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByLabel("Title").fill(title);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create task" })
      .click();
    const taskTitle = page.locator(".ui-task-card-title", { hasText: title });
    await expect(taskTitle).toHaveText(title);
    await page.evaluate(() => document.fonts.ready);
    await expect(taskTitle).toHaveCSS("font-family", /Inter/);
  });
});

test.describe("system theme follows the OS", () => {
  test.use({ colorScheme: "light" });

  test("System uses light tokens", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-surface-base")
        .trim()
        .toLowerCase(),
    );
    expect(surface).toBe("#f7f4fb");
  });
});

test.describe("dark override ignores the OS", () => {
  test.use({ colorScheme: "light" });

  test("Dark stays dark after reload while the OS is light", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme-persisted",
      "dark",
    );
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-surface-base")
        .trim()
        .toLowerCase(),
    );
    expect(surface).toBe("#16121f");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const after = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-surface-base")
        .trim()
        .toLowerCase(),
    );
    expect(after).toBe("#16121f");
  });
});

test.describe("narrow Daily Desk", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("shows Day by default and keeps the mode control visible", async ({
    page,
  }) => {
    await page.goto("/");
    const modes = page.getByRole("radiogroup", { name: "Daily Desk mode" });
    await expect(modes).toBeVisible();
    await expect(modes.getByRole("radio", { name: "Day" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("region", { name: "Day" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tasks" })).toBeHidden();
    await expect(page.getByRole("region", { name: "Now" })).toBeHidden();
    await modes.getByRole("radio", { name: "Tasks" }).click();
    await expect(page.getByRole("region", { name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Day" })).toBeHidden();
  });
});

test.describe("desktop Daily Desk", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("gives the timeline width priority over both rails", async ({
    page,
  }) => {
    await page.goto("/");
    const tray = page.locator('[data-zone="tray"]');
    const timeline = page.locator('[data-zone="timeline"]');
    const now = page.locator('[data-zone="now"]');
    await expect(tray).toBeVisible();
    await expect(timeline).toBeVisible();
    await expect(now).toBeVisible();
    await page.getByRole("button", { name: "Collapse tray" }).click();
    await expect(
      page.getByRole("button", { name: "Expand tray" }),
    ).toBeVisible();
    await expect(tray).toBeVisible();
    await expect(timeline).toBeVisible();
    const widths = await page.evaluate(() => {
      const zone = (name: string) => {
        const node = document.querySelector(`[data-zone="${name}"]`);
        return node instanceof HTMLElement
          ? node.getBoundingClientRect().width
          : 0;
      };
      return {
        tray: zone("tray"),
        timeline: zone("timeline"),
        now: zone("now"),
      };
    });
    expect(widths.timeline).toBeGreaterThan(widths.tray);
    expect(widths.timeline).toBeGreaterThan(widths.now);
  });
});

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("has no horizontal page scrolling", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  });
}

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
