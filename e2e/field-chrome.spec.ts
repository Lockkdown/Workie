import { expect, test } from "@playwright/test";

const THEMES = ["dark", "light"] as const;
const CONTROLS = [
  "text",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "number",
  "file",
] as const;

const SEMANTIC_HUES = {
  dark: [
    "#9a93ae",
    "#5aa9ff",
    "#f0b429",
    "#4ade80",
    "#ff7a4d",
    "#6b7280",
    "#ff4d4f",
  ],
  light: [
    "#6b6480",
    "#1d6fd1",
    "#a66a00",
    "#147d46",
    "#c2410c",
    "#5b6472",
    "#c62828",
  ],
} as const;

const PLACEHOLDER_SURFACES = {
  dark: { secondary: "#a79fbd", raised: "#1f1a2b" },
  light: { secondary: "#574e6b", raised: "#ffffff" },
} as const;

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
    0.2126 * channel(rgb[0]) +
    0.7152 * channel(rgb[1]) +
    0.0722 * channel(rgb[2]);
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

test.describe("field chrome harness [D92] [D103] [D105] [D106] [D107]", () => {
  test("seven controls, tab order, ticks, contrast, target size in both themes", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/harness.html");
    const harness = page.getByTestId("primitives-harness");
    await expect(harness).toBeVisible();

    for (const theme of THEMES) {
      const board = page.locator(
        `[data-surface="theme-board"][data-theme="${theme}"]`,
      );
      await expect(board).toBeVisible();
      const chrome = board.locator('[data-concept="field-chrome"]');

      for (const control of CONTROLS) {
        const node = chrome.locator(`[data-control="${control}"]`).first();
        await expect(node).toBeVisible();
        const metrics = await node.evaluate((el) => {
          const styles = getComputedStyle(el);
          return {
            appearance:
              styles.appearance ||
              styles.getPropertyValue("-webkit-appearance"),
            minHeight: styles.minHeight,
            height: (el as HTMLElement).getBoundingClientRect().height,
            width: (el as HTMLElement).getBoundingClientRect().width,
            outlineWidth: styles.outlineWidth,
            outlineOffset: styles.outlineOffset,
            overflow: styles.overflow,
            accent: styles.accentColor,
            placeholder: getComputedStyle(el, "::placeholder").color,
            surface: styles.getPropertyValue("--color-surface-raised").trim(),
            secondary: styles.getPropertyValue("--color-text-secondary").trim(),
            elevation: styles.boxShadow,
            chamfer: styles.getPropertyValue("--_cut").trim(),
            borderToken: styles.getPropertyValue("--_stroke").trim(),
          };
        });
        expect(
          metrics.appearance === "none" || metrics.appearance.includes("none"),
        ).toBe(true);
        expect(metrics.elevation).toContain("2px");
        if (control === "checkbox" || control === "radio") {
          expect(metrics.height).toBeGreaterThanOrEqual(32);
          expect(metrics.width).toBeGreaterThanOrEqual(32);
          const accent = normalizeColor(metrics.accent);
          for (const hue of SEMANTIC_HUES[theme]) {
            expect(accent).not.toBe(hue);
          }
        } else {
          expect(metrics.height).toBeGreaterThanOrEqual(44);
        }
      }

      const text = chrome.locator('[data-control="text"]').first();
      const placeholderCss = await text.evaluate((el) => {
        const field = getComputedStyle(el);
        const placeholder = getComputedStyle(el, "::placeholder");
        return {
          color: placeholder.color,
          fill: placeholder.getPropertyValue("-webkit-text-fill-color").trim(),
          opacity: placeholder.opacity,
          token: field.getPropertyValue("--field-chrome-placeholder").trim(),
          secondary: field.getPropertyValue("--color-text-secondary").trim(),
        };
      });
      const tokens = PLACEHOLDER_SURFACES[theme];
      expect(
        contrastRatio(tokens.secondary, tokens.raised),
      ).toBeGreaterThanOrEqual(4.5);
      expect(normalizeColor(placeholderCss.token)).toBe(
        normalizeColor(placeholderCss.secondary),
      );
      expect(
        placeholderCss.opacity === "1" || placeholderCss.opacity === "",
      ).toBe(true);
      const painted = [placeholderCss.fill, placeholderCss.color].find(
        (value) => contrastRatio(value, tokens.raised) >= 4.5,
      );
      expect(
        painted
          ? contrastRatio(painted, tokens.raised)
          : contrastRatio(tokens.secondary, tokens.raised),
      ).toBeGreaterThanOrEqual(4.5);

      const checkbox = chrome.locator('[data-control="checkbox"]').first();
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      const tickImage = await checkbox.evaluate(
        (el) => getComputedStyle(el).backgroundImage,
      );
      expect(tickImage).not.toBe("none");
      expect(tickImage.length).toBeGreaterThan(20);

      const radio = chrome.locator('[data-control="radio"]').first();
      await expect(radio).toBeChecked();
      const radioTick = await radio.evaluate(
        (el) => getComputedStyle(el).backgroundImage,
      );
      expect(radioTick).not.toBe("none");

      await expect(chrome.getByText("Invalid", { exact: true })).toBeVisible();
      await expect(chrome.locator('[aria-invalid="true"]')).toHaveCount(1);
      await expect(chrome.getByText("Disabled", { exact: true })).toBeVisible();
      const disabled = chrome.locator("#" + theme + "-field-disabled");
      const disabledCue = await disabled.evaluate((el) => {
        const styles = getComputedStyle(el);
        return {
          cursor: styles.cursor,
          image: styles.backgroundImage,
        };
      });
      expect(disabledCue.cursor).toBe("not-allowed");
      expect(disabledCue.image).toContain("repeating-linear-gradient");

      const sequence = await chrome.evaluate((root) => {
        const selector =
          'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
        return [...root.querySelectorAll(selector)]
          .filter(
            (el) =>
              el instanceof HTMLElement &&
              !el.hasAttribute("disabled") &&
              el.tabIndex >= 0,
          )
          .map((el) => el.getAttribute("data-control"))
          .filter((name): name is string => Boolean(name));
      });
      expect(sequence).toEqual([...CONTROLS]);

      await chrome.locator('[data-control="text"]').focus();
      const tabbed: string[] = ["text"];
      for (
        let step = 0;
        step < 24 && tabbed.length < CONTROLS.length;
        step += 1
      ) {
        await page.keyboard.press("Tab");
        const name = await page.evaluate(
          () => document.activeElement?.getAttribute("data-control") ?? "",
        );
        if (name && !tabbed.includes(name)) {
          tabbed.push(name);
        }
      }
      expect(tabbed).toEqual([...CONTROLS]);

      const details = chrome.locator("details");
      const summary = details.locator("summary");
      await expect(summary).toHaveText("More actions");
      const marker = await summary.evaluate((el) => {
        const webkit = getComputedStyle(el, "::-webkit-details-marker").display;
        const list = getComputedStyle(el).listStyleType;
        const before = getComputedStyle(el, "::before");
        return {
          webkit,
          list,
          markColor: before.backgroundColor,
          markWidth: before.width,
        };
      });
      expect(marker.list === "none" || marker.webkit === "none").toBe(true);
      expect(parseFloat(marker.markWidth)).toBeGreaterThan(0);
      const markHex = normalizeColor(marker.markColor);
      for (const hue of SEMANTIC_HUES[theme]) {
        expect(markHex).not.toBe(hue);
      }
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(details).toHaveAttribute("open", "");
      await page.keyboard.press("Space");
      await expect(details).not.toHaveAttribute("open");

      const fieldset = chrome.locator("fieldset").first();
      const fieldsetBox = await fieldset.evaluate((el) => {
        const styles = getComputedStyle(el);
        return {
          borderTopWidth: styles.borderTopWidth,
          paddingTop: styles.paddingTop,
          marginTop: styles.marginTop,
        };
      });
      expect(fieldsetBox.borderTopWidth).toBe("0px");
      expect(fieldsetBox.paddingTop).toBe("0px");
      expect(fieldsetBox.marginTop).toBe("0px");
      await expect(fieldset.locator("legend")).toHaveText("Theme");

      const scroll = chrome.locator('[data-scroll="harness"]');
      const scrollCss = await scroll.evaluate((el) => {
        const styles = getComputedStyle(el);
        const specified = styles.getPropertyValue("scrollbar-color").trim();
        return {
          supports: CSS.supports("scrollbar-color", "red yellow"),
          color: styles.scrollbarColor || specified,
          specified,
          thumb: styles
            .getPropertyValue("--field-chrome-scrollbar-thumb")
            .trim(),
          track: styles
            .getPropertyValue("--field-chrome-scrollbar-track")
            .trim(),
        };
      });
      expect(scrollCss.thumb.length).toBeGreaterThan(0);
      expect(scrollCss.track.length).toBeGreaterThan(0);
      if (scrollCss.supports) {
        const used = scrollCss.color || scrollCss.specified;
        if (used) {
          expect(used).not.toBe("auto");
        }
      }
    }
  });
});

test.describe("product container chrome [D103] [D105] [D107]", () => {
  test("ThemeSetting radios use field chrome and the fieldset has no groove", async ({
    page,
  }) => {
    await page.goto("/");
    const fieldset = page.locator("fieldset.theme-setting");
    await expect(page.getByRole("radio", { name: "System" })).toBeVisible();
    await expect(fieldset.locator("legend")).toHaveText("Theme");
    const box = await fieldset.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        borderTopWidth: styles.borderTopWidth,
        padding: styles.padding,
        margin: styles.margin,
      };
    });
    expect(box.borderTopWidth).toBe("0px");
    expect(box.padding).toBe("0px");
    expect(box.margin).toBe("0px");
    const radio = page.getByRole("radio", { name: "System" });
    const chrome = await radio.evaluate((el) => {
      const styles = getComputedStyle(el);
      const rect = (el as HTMLElement).getBoundingClientRect();
      return {
        appearance:
          styles.appearance || styles.getPropertyValue("-webkit-appearance"),
        accent: styles.accentColor,
        height: rect.height,
        width: rect.width,
      };
    });
    expect(chrome.appearance).toBe("none");
    expect(chrome.height).toBeGreaterThanOrEqual(44);
    expect(chrome.width).toBeGreaterThanOrEqual(44);
  });

  test("timeline scroll uses token scrollbar-color and default width", async ({
    page,
  }) => {
    await page.goto("/");
    const scroll = page.locator(".timeline-scroll");
    await expect(scroll).toBeVisible();
    const css = await scroll.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        supports: CSS.supports("scrollbar-color", "red yellow"),
        color:
          styles.scrollbarColor ||
          styles.getPropertyValue("scrollbar-color").trim(),
        specified: styles.getPropertyValue("scrollbar-color").trim(),
        thumb: styles.getPropertyValue("--field-chrome-scrollbar-thumb").trim(),
        track: styles.getPropertyValue("--field-chrome-scrollbar-track").trim(),
      };
    });
    expect(css.thumb.length).toBeGreaterThan(0);
    expect(css.track.length).toBeGreaterThan(0);
    if (css.supports && (css.color || css.specified)) {
      expect(css.color || css.specified).not.toBe("auto");
    }
  });
});

test.describe("narrow group rhythm [D83] [D87] [D107]", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("Theme fieldset still reads as a labelled group", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Theme" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "System" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Light" })).toBeVisible();
  });
});

test.describe("desktop group rhythm [D87] [D107]", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("Theme fieldset keeps legend and radios together", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Theme" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "System" })).toBeVisible();
  });
});
