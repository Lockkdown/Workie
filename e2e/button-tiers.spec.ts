import { expect, test, type Page } from "@playwright/test";

const THEMES = ["dark", "light"] as const;
const TIERS = ["primary", "secondary", "quiet"] as const;
const ALLOWED_FAMILIES = [
  "pixelify sans",
  "pixelify sans fallback",
  "inter",
  "inter fallback",
  "system-ui",
  "sans-serif",
  "arial",
  "segoe ui",
  "ui-sans-serif",
  "-apple-system",
  "blinkmacsystemfont",
  "helvetica",
  "helvetica neue",
  "times new roman",
] as const;

function parseRgb(value: string): [number, number, number] | undefined {
  const hex = value.trim().toLowerCase();
  if (hex.startsWith("#") && hex.length === 7) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }
  const match = value.match(
    /rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/i,
  );
  if (!match) {
    return undefined;
  }
  return [
    Number.parseFloat(match[1] ?? "0"),
    Number.parseFloat(match[2] ?? "0"),
    Number.parseFloat(match[3] ?? "0"),
  ];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: string, b: string): number {
  const rgbA = parseRgb(a);
  const rgbB = parseRgb(b);
  if (!rgbA || !rgbB) {
    return 0;
  }
  const lum = (rgb: [number, number, number]) =>
    0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const l1 = lum(rgbA);
  const l2 = lum(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function normalizeColor(value: string): string {
  const rgb = parseRgb(value);
  if (!rgb) {
    return value.trim().toLowerCase();
  }
  const hex = rgb
    .map((part) => Math.round(part).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

async function assertEveryButtonHasOneTier(page: Page): Promise<void> {
  const rows = await page.locator("button").evaluateAll((nodes) =>
    nodes.map((el) => ({
      variant: el.getAttribute("data-variant"),
      className: el.className,
      name: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 48),
    })),
  );
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(
      TIERS.includes(row.variant as (typeof TIERS)[number]),
      `${row.name} variant=${row.variant}`,
    ).toBe(true);
    expect(row.className.split(/\s+/)).not.toContain("ui-field");
  }
}

test.describe("button tiers and display roles [D109] [D110]", () => {
  test("every harness button is one tier; file is secondary; no field chrome", async ({
    page,
  }) => {
    await page.goto("/harness.html");
    await expect(page.getByTestId("primitives-harness")).toBeVisible();
    await assertEveryButtonHasOneTier(page);

    for (const theme of THEMES) {
      const board = page.locator(
        `[data-surface="theme-board"][data-theme="${theme}"]`,
      );
      const file = board.locator('[data-control="file"]').first();
      await expect(file).toHaveAttribute("data-variant", "secondary");
      await expect(file).toHaveClass(/ui-button/);
      await expect(file).not.toHaveClass(/ui-field/);
      const primaries = board.locator('[data-variant="primary"]');
      await expect(primaries).toHaveCount(1);
    }
    await expect(page.locator('[data-variant="destructive"]')).toHaveCount(0);
    await expect(page.locator("button.ui-field")).toHaveCount(0);
  });

  test("secondary frames use chamfer + field-chrome-border and clear 3:1 in both themes [D108] [D109]", async ({
    page,
  }) => {
    await page.goto("/harness.html");
    const rows: Array<{
      theme: string;
      edge: string;
      surface: string;
      ratio: number;
      chamfer: string;
    }> = [];

    for (const theme of THEMES) {
      const board = page.locator(
        `[data-surface="theme-board"][data-theme="${theme}"]`,
      );
      const buttons = board.locator(".ui-button[data-variant='secondary']");
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const measured = await buttons.nth(index).evaluate((el) => {
          const styles = getComputedStyle(el);
          const resolve = (name: string): string => {
            let value = styles.getPropertyValue(name).trim();
            if (value.startsWith("var(")) {
              const inner = value.slice(4, value.endsWith(")") ? -1 : undefined);
              value = styles
                .getPropertyValue(inner.split(",")[0]?.trim() ?? "")
                .trim();
            }
            return value;
          };
          const edge = resolve("--field-chrome-border");
          const assigned = resolve("--_border");
          let surface = "";
          let ancestor: HTMLElement | null = el.parentElement;
          while (ancestor) {
            const bg = getComputedStyle(ancestor).backgroundColor;
            const match = bg.match(
              /rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*\/\s*|\s*,\s*)?([\d.]*)/,
            );
            const alpha =
              match?.[4] === "" || match?.[4] === undefined
                ? 1
                : Number.parseFloat(match[4] ?? "1");
            if (match && alpha > 0 && bg !== "transparent") {
              surface = bg;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          return {
            edge,
            assigned,
            surface,
            chamfer: styles.getPropertyValue("--_chamfer").trim(),
            quiet: resolve("--color-border-quiet"),
            strong: resolve("--color-border-strong"),
          };
        });
        const ratio = contrastRatio(measured.edge, measured.surface);
        rows.push({
          theme,
          edge: normalizeColor(measured.edge),
          surface: normalizeColor(measured.surface),
          ratio,
          chamfer: measured.chamfer,
        });
        expect(measured.chamfer.length).toBeGreaterThan(0);
        expect(normalizeColor(measured.assigned)).toBe(
          normalizeColor(measured.edge),
        );
        expect(normalizeColor(measured.edge)).not.toBe(
          normalizeColor(measured.quiet),
        );
        expect(normalizeColor(measured.edge)).not.toBe(
          normalizeColor(measured.strong),
        );
        expect(
          ratio,
          `${theme} secondary ${normalizeColor(measured.edge)} on ${normalizeColor(measured.surface)} = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(3);
      }
    }

    console.log(
      "T15 secondary-frame ratios\n" +
        rows
          .map(
            (row) =>
              `${row.theme.padEnd(5)} ${row.edge} on ${row.surface} chamfer=${row.chamfer} = ${row.ratio.toFixed(2)}:1`,
          )
          .join("\n"),
    );
  });

  test("quiet meets target size and the shared focus indicator [D92] [D109]", async ({
    page,
  }) => {
    await page.goto("/harness.html");
    const quiet = page
      .locator(
        '[data-surface="theme-board"][data-theme="dark"] .ui-button[data-variant="quiet"]',
      )
      .first();
    await expect(quiet).toBeVisible();
    const box = await quiet.evaluate((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      const styles = getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        borderWidth: styles.borderTopWidth,
        boxShadow: styles.boxShadow,
      };
    });
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.borderWidth).toBe("0px");
    expect(box.boxShadow === "none" || box.boxShadow === "").toBe(true);
    await quiet.focus();
    await expect(quiet).toBeFocused();
    const focus = await quiet.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        outlineWidth: styles.outlineWidth,
        outlineOffset: styles.outlineOffset,
        outlineStyle: styles.outlineStyle,
      };
    });
    expect(parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(parseFloat(focus.outlineOffset)).toBeGreaterThanOrEqual(2);
    expect(focus.outlineStyle).not.toBe("none");
  });

  test("Pixelify stays on the seven display roles; labels and legends are Inter [D110]", async ({
    page,
  }) => {
    await page.goto("/harness.html");
    await expect(page.getByTestId("primitives-harness")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const harness = await page.evaluate(() => {
      const isDisplayRole = (el: Element): boolean =>
        el.classList.contains("type-display-xl") ||
        el.classList.contains("type-display-l") ||
        el.classList.contains("type-display-m") ||
        el.classList.contains("type-timer") ||
        el.classList.contains("app-nav-item") ||
        el.classList.contains("desk-mode");
      const underDisplayRole = (el: Element): boolean => {
        let current: Element | null = el;
        while (current) {
          if (isDisplayRole(current)) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      };
      const leftovers: string[] = [];
      for (const el of document.querySelectorAll("body *")) {
        const family = getComputedStyle(el).fontFamily.toLowerCase();
        if (!family.includes("pixelify")) {
          continue;
        }
        if (!underDisplayRole(el)) {
          leftovers.push(
            `${el.tagName.toLowerCase()}.${el.className} ${family}`,
          );
        }
      }
      const labels = [...document.querySelectorAll("label, legend")].map(
        (el) => getComputedStyle(el).fontFamily,
      );
      return { leftovers, labels };
    });
    expect(harness.leftovers).toEqual([]);
    expect(harness.labels.length).toBeGreaterThan(0);
    for (const family of harness.labels) {
      expect(family).toMatch(/Inter/i);
      expect(family).not.toMatch(/Pixelify/i);
    }

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const appTitleFamily = await page
      .getByRole("heading", { name: "Workie" })
      .evaluate((el) => {
        const styles = getComputedStyle(el);
        return `${styles.fontFamily} ${styles.getPropertyValue("--font-display")}`;
      });
    expect(appTitleFamily).toMatch(/Pixelify/i);
    await expect(page.getByRole("heading", { name: "Daily Desk" })).toHaveCSS(
      "font-family",
      /Pixelify/i,
    );
    const nav = page
      .getByRole("navigation", { name: "App" })
      .getByRole("button", { name: "Daily Desk" });
    await expect(nav).toHaveCSS("font-family", /Pixelify/i);
    const legend = page.locator("fieldset.theme-setting legend");
    await expect(legend).toHaveText("Theme");
    await expect(legend).toHaveCSS("font-family", /Inter/i);
    await expect(legend).not.toHaveCSS("font-family", /Pixelify/i);
    await expect(page.getByRole("radio", { name: "System" })).toBeVisible();
    const option = page.locator("label.theme-option").first();
    await expect(option).toHaveCSS("font-family", /Inter/i);
  });

  test("nav and mode control are quiet, unframed, with a non-colour selected signal [D85] [D109]", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    const desk = page
      .getByRole("navigation", { name: "App" })
      .getByRole("button", { name: "Daily Desk" });
    await expect(desk).toHaveAttribute("data-variant", "quiet");
    const navCss = await desk.evaluate((el) => {
      const styles = getComputedStyle(el);
      const rect = (el as HTMLElement).getBoundingClientRect();
      return {
        borderLeftWidth: styles.borderLeftWidth,
        borderTopWidth: styles.borderTopWidth,
        boxShadow: styles.boxShadow,
        width: rect.width,
        height: rect.height,
      };
    });
    expect(parseFloat(navCss.borderLeftWidth)).toBeGreaterThanOrEqual(2);
    expect(navCss.borderTopWidth).toBe("0px");
    expect(navCss.boxShadow === "none" || navCss.boxShadow === "").toBe(true);
    expect(navCss.width).toBeGreaterThanOrEqual(44);
    expect(navCss.height).toBeGreaterThanOrEqual(44);

    const mode = page.getByRole("radio", { name: "Day" });
    await expect(mode).toHaveAttribute("data-variant", "quiet");
    const modeCss = await mode.evaluate((el) => {
      const styles = getComputedStyle(el);
      const rect = (el as HTMLElement).getBoundingClientRect();
      return {
        borderLeftWidth: styles.borderLeftWidth,
        borderTopWidth: styles.borderTopWidth,
        boxShadow: styles.boxShadow,
        width: rect.width,
        height: rect.height,
      };
    });
    expect(parseFloat(modeCss.borderLeftWidth)).toBeGreaterThanOrEqual(2);
    expect(modeCss.borderTopWidth).toBe("0px");
    expect(modeCss.boxShadow === "none" || modeCss.boxShadow === "").toBe(
      true,
    );
    expect(modeCss.width).toBeGreaterThanOrEqual(44);
    expect(modeCss.height).toBeGreaterThanOrEqual(44);
    await mode.focus();
    await expect(mode).toBeFocused();
  });

  test("app surfaces keep one primary at most; Reports has none [D88]", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    await assertEveryButtonHasOneTier(page);
    await expect(page.locator("button.ui-field")).toHaveCount(0);
    const fileTrigger = page.locator(".ui-file-control .ui-button");
    await expect(fileTrigger).toHaveAttribute("data-variant", "secondary");
    await expect(page.getByText("Choose file", { exact: true })).toBeVisible();

    const deskPrimaries = await page.locator('[data-variant="primary"]').count();
    expect(deskPrimaries).toBeLessThanOrEqual(1);

    await page
      .getByRole("navigation", { name: "App" })
      .getByRole("button", { name: "Reports" })
      .click();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await assertEveryButtonHasOneTier(page);
    await expect(page.locator('[data-variant="primary"]')).toHaveCount(0);

    await page
      .getByRole("navigation", { name: "App" })
      .getByRole("button", { name: "Plan Tomorrow" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Plan Tomorrow" }),
    ).toBeVisible();
    await assertEveryButtonHasOneTier(page);
    const planPrimaries = await page.locator('[data-variant="primary"]').count();
    expect(planPrimaries).toBeLessThanOrEqual(1);
  });

  test("Daily Desk keeps identity signs and Inter still renders Vietnamese [D78] [D80] [D94]", async ({
    page,
  }) => {
    const title = "Họp với khách hàng";
    await page.goto("/");
    const scene = page.getByRole("heading", { name: "Daily Desk" });
    await expect(scene).toBeVisible();
    const sceneFamily = await scene.evaluate((el) => {
      const styles = getComputedStyle(el);
      return `${styles.fontFamily} ${styles.getPropertyValue("--font-display")}`;
    });
    expect(sceneFamily).toMatch(/Pixelify/i);
    await expect(page.locator('[data-zone="timeline"]')).toHaveClass(
      /ui-ornament/,
    );
    const deskPrimaries = await page.locator('[data-variant="primary"]').count();
    expect(deskPrimaries).toBeLessThanOrEqual(1);

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
    await expect(taskTitle).toHaveCSS("font-family", /Inter/i);
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    await expect(page.getByText("Daily Desk").first()).toBeVisible();
  });

  test("no third authored family appears on harness or Daily Desk [D77] [D80]", async ({
    page,
  }) => {
    for (const path of ["/harness.html", "/"] as const) {
      await page.goto(path);
      if (path === "/") {
        await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
      } else {
        await expect(page.getByTestId("primitives-harness")).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      const tokens = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        return {
          display: styles.getPropertyValue("--font-display").toLowerCase(),
          body: styles.getPropertyValue("--font-body").toLowerCase(),
        };
      });
      expect(tokens.display).toContain("pixelify");
      expect(tokens.body).toContain("inter");
      expect(tokens.display).not.toMatch(/roboto|georgia|comic|papyrus/);
      expect(tokens.body).not.toMatch(/roboto|georgia|comic|papyrus/);
      expect(tokens.display).not.toContain("inter");
      expect(tokens.body).not.toContain("pixelify");
      const families = await page.evaluate(() => {
        const found = new Set<string>();
        for (const el of document.querySelectorAll("body *")) {
          for (const part of getComputedStyle(el).fontFamily.split(",")) {
            const name = part.replace(/['"]/g, "").trim().toLowerCase();
            if (name) {
              found.add(name);
            }
          }
        }
        return [...found];
      });
      for (const family of families) {
        expect(
          ALLOWED_FAMILIES.includes(family as (typeof ALLOWED_FAMILIES)[number]),
          `${path} unexpected family ${family}`,
        ).toBe(true);
      }
    }
  });
});
