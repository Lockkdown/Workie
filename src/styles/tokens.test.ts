import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "tokens.css"),
  "utf8",
);

function braceBlock(css: string, fromIdx: number): string {
  const start = css.indexOf("{", fromIdx);
  if (start < 0) {
    throw new Error("missing opening brace");
  }
  let depth = 0;
  for (let i = start; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(start + 1, i);
      }
    }
  }
  throw new Error("unbalanced braces");
}

function decls(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of block.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith("--")) {
      continue;
    }
    const colon = trimmed.indexOf(":");
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    out[key] = value;
  }
  return out;
}

function themeDecls(marker: string): Record<string, string> {
  const idx = tokensCss.indexOf(marker);
  if (idx < 0) {
    throw new Error(`missing ${marker}`);
  }
  return decls(braceBlock(tokensCss, idx));
}

function token(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match?.[1]) {
    throw new Error(`missing ${name}`);
  }
  return match[1].trim().toLowerCase();
}

const DARK = {
  "--color-surface-base": "#16121f",
  "--color-surface-raised": "#1f1a2b",
  "--color-surface-panel": "#2a2338",
  "--color-border-quiet": "#3d3450",
  "--color-border-strong": "#5a4e74",
  "--color-text-primary": "#ede9f5",
  "--color-text-secondary": "#a79fbd",
  "--color-brand-coral": "#ff6b8a",
  "--color-brand-mint": "#5ee6c0",
} as const;

const LIGHT = {
  "--color-surface-base": "#f7f4fb",
  "--color-surface-raised": "#ffffff",
  "--color-surface-panel": "#efe9f6",
  "--color-border-quiet": "#d5cce4",
  "--color-border-strong": "#b3a5c9",
  "--color-text-primary": "#1c1726",
  "--color-text-secondary": "#574e6b",
  "--color-brand-coral": "#d93a63",
  "--color-brand-mint": "#0e8f73",
} as const;

const DARK_STATUS = {
  "--color-status-waiting": "#9a93ae",
  "--color-status-in-progress": "#5aa9ff",
  "--color-status-deferred": "#f0b429",
  "--color-status-completed": "#4ade80",
  "--color-status-abandoned": "#ff7a4d",
  "--color-status-cancelled": "#6b7280",
  "--color-status-conflict": "#ff4d4f",
} as const;

const LIGHT_STATUS = {
  "--color-status-waiting": "#6b6480",
  "--color-status-in-progress": "#1d6fd1",
  "--color-status-deferred": "#a66a00",
  "--color-status-completed": "#147d46",
  "--color-status-abandoned": "#c2410c",
  "--color-status-cancelled": "#5b6472",
  "--color-status-conflict": "#c62828",
} as const;

const DARK_CONTRIBUTION = {
  "--color-contribution-0": "#221c2e",
  "--color-contribution-1": "#1f5b4c",
  "--color-contribution-2": "#2a8a70",
  "--color-contribution-3": "#3fb894",
  "--color-contribution-4plus": "#5ee6c0",
} as const;

const LIGHT_CONTRIBUTION = {
  "--color-contribution-0": "#e7e1f0",
  "--color-contribution-1": "#b8e8d8",
  "--color-contribution-2": "#7dd2b8",
  "--color-contribution-3": "#3da98a",
  "--color-contribution-4plus": "#0e8f73",
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("F9 colour tokens", () => {
  it("authors dark as the source table, not an inversion of light", () => {
    const dark = themeDecls('[data-theme="dark"]');
    for (const [name, value] of Object.entries(DARK)) {
      expect(dark[name]).toBe(value);
    }
  });

  it("authors light separately with the F9 light table", () => {
    const light = themeDecls('[data-theme="light"]');
    for (const [name, value] of Object.entries(LIGHT)) {
      expect(light[name]).toBe(value);
    }
    expect(light["--color-surface-base"]).not.toBe(
      themeDecls('[data-theme="dark"]')["--color-surface-base"],
    );
  });

  it("keeps semantic tokens separate from brand tokens", () => {
    const dark = themeDecls('[data-theme="dark"]');
    const light = themeDecls('[data-theme="light"]');
    for (const [name, value] of Object.entries(DARK_STATUS)) {
      expect(dark[name]).toBe(value);
    }
    for (const [name, value] of Object.entries(LIGHT_STATUS)) {
      expect(light[name]).toBe(value);
    }
    const brand = ["--color-brand-coral", "--color-brand-mint"];
    const statusNames = Object.keys(DARK_STATUS);
    for (const theme of [dark, light]) {
      for (const statusName of statusNames) {
        expect(brand.includes(statusName)).toBe(false);
        expect(theme[statusName]).not.toBeUndefined();
      }
    }
  });

  it("defines contribution intensity 0, 1, 2, 3, and 4+", () => {
    const dark = themeDecls('[data-theme="dark"]');
    const light = themeDecls('[data-theme="light"]');
    for (const [name, value] of Object.entries(DARK_CONTRIBUTION)) {
      expect(dark[name]).toBe(value);
    }
    for (const [name, value] of Object.entries(LIGHT_CONTRIBUTION)) {
      expect(light[name]).toBe(value);
    }
  });

  it("lets system follow prefers-color-scheme", () => {
    expect(tokensCss).toMatch(/\[data-theme="system"\]/);
    expect(tokensCss).toMatch(/prefers-color-scheme:\s*light/);
  });
});

describe("F9 type, space, geometry, motion", () => {
  it("restricts Pixelify Sans to display and timer roles", () => {
    expect(token(tokensCss, "--font-display")).toContain("pixelify sans");
    expect(token(tokensCss, "--font-body")).toContain("inter");
    expect(token(tokensCss, "--font-body")).not.toContain("pixelify");
    expect(token(tokensCss, "--type-display-xl-family")).toBe(
      "var(--font-display)",
    );
    expect(token(tokensCss, "--type-display-l-family")).toBe(
      "var(--font-display)",
    );
    expect(token(tokensCss, "--type-display-m-family")).toBe(
      "var(--font-display)",
    );
    expect(token(tokensCss, "--type-timer-family")).toBe("var(--font-display)");
    expect(token(tokensCss, "--type-body-l-family")).toBe("var(--font-body)");
    expect(token(tokensCss, "--type-body-m-family")).toBe("var(--font-body)");
    expect(token(tokensCss, "--type-body-s-family")).toBe("var(--font-body)");
    expect(token(tokensCss, "--type-numeric-family")).toBe("var(--font-body)");
    expect(token(tokensCss, "--type-timer-numeric")).toBe("tabular-nums");
    expect(token(tokensCss, "--type-numeric-variant")).toBe("tabular-nums");
    expect(token(tokensCss, "--type-display-xl-size")).toBe("32px");
    expect(token(tokensCss, "--type-display-xl-line")).toBe("36px");
    expect(token(tokensCss, "--type-timer-size")).toBe("48px");
  });

  it("exposes content density and structural separation spacing", () => {
    expect(token(tokensCss, "--space-content-4")).toBe("4px");
    expect(token(tokensCss, "--space-content-8")).toBe("8px");
    expect(token(tokensCss, "--space-content-12")).toBe("12px");
    expect(token(tokensCss, "--space-structure-16")).toBe("16px");
    expect(token(tokensCss, "--space-structure-24")).toBe("24px");
    expect(token(tokensCss, "--space-structure-32")).toBe("32px");
    expect(token(tokensCss, "--space-structure-48")).toBe("48px");
  });

  it("implements chamfer 4/8/12, border 1/2/3, and a flat elevation offset", () => {
    expect(token(tokensCss, "--chamfer-4")).toBe("4px");
    expect(token(tokensCss, "--chamfer-8")).toBe("8px");
    expect(token(tokensCss, "--chamfer-12")).toBe("12px");
    expect(token(tokensCss, "--border-1")).toBe("1px");
    expect(token(tokensCss, "--border-2")).toBe("2px");
    expect(token(tokensCss, "--border-3")).toBe("3px");
    expect(token(tokensCss, "--elevation-offset")).toBe("0 2px 0");
    expect(token(tokensCss, "--elevation-offset")).not.toContain("blur");
  });

  it("defines motion tokens and collapses them under prefers-reduced-motion", () => {
    expect(token(tokensCss, "--duration-micro")).toBe("120ms");
    expect(token(tokensCss, "--duration-move")).toBe("180ms");
    expect(token(tokensCss, "--duration-panel")).toBe("240ms");
    expect(token(tokensCss, "--duration-ritual")).toBe("600ms");
    const queryIdx = tokensCss.indexOf("prefers-reduced-motion");
    expect(queryIdx).toBeGreaterThan(-1);
    const media = braceBlock(tokensCss, queryIdx);
    const reduced = decls(braceBlock(media, media.indexOf(":root")));
    expect(reduced["--duration-micro"]).toBe("0ms");
    expect(reduced["--duration-move"]).toBe("0ms");
    expect(reduced["--duration-panel"]).toBe("0ms");
    expect(reduced["--duration-ritual"]).toBe("0ms");
    expect(reduced["--duration-opacity"]).toBe("120ms");
  });

  it("keeps text, borders, and focus resolvable under forced-colors", () => {
    expect(tokensCss).toMatch(/forced-colors:\s*active/);
    const queryIdx = tokensCss.indexOf("forced-colors");
    const media = braceBlock(tokensCss, queryIdx);
    expect(media).toContain("CanvasText");
    expect(media).toContain("ButtonBorder");
    expect(media).toContain("Highlight");
  });

  it("sets a 2px keyboard focus indicator with a 2px offset", () => {
    expect(token(tokensCss, "--focus-outline-width")).toBe("2px");
    expect(token(tokensCss, "--focus-outline-offset")).toBe("2px");
    expect(tokensCss).toMatch(
      /outline:\s*var\(--focus-outline-width\)\s+solid\s+var\(--color-focus\)/,
    );
    expect(tokensCss).toMatch(
      /outline-offset:\s*var\(--focus-outline-offset\)/,
    );
  });

  it("defines field chrome tokens from the F9 initial set [D103] [D105]", () => {
    expect(token(tokensCss, "--field-chrome-size-compact")).toBe("32px");
    expect(token(tokensCss, "--field-chrome-size-touch")).toBe("44px");
    expect(token(tokensCss, "--field-chrome-accent")).toBe(
      "var(--color-text-primary)",
    );
    expect(token(tokensCss, "--field-chrome-surface")).toBe(
      "var(--color-surface-raised)",
    );
    expect(token(tokensCss, "--field-chrome-border")).toBe(
      "var(--color-border-quiet)",
    );
    expect(token(tokensCss, "--field-chrome-placeholder")).toBe(
      "var(--color-text-secondary)",
    );
    expect(token(tokensCss, "--field-chrome-mark")).toBe(
      "var(--color-text-secondary)",
    );
    expect(token(tokensCss, "--field-chrome-scrollbar-thumb")).toBe(
      "var(--color-text-secondary)",
    );
    expect(token(tokensCss, "--field-chrome-scrollbar-track")).toBe(
      "var(--color-surface-raised)",
    );
    expect(token(tokensCss, "--field-chrome-accent")).not.toContain(
      "color-status",
    );
  });
});

describe("contrast of intended token pairs", () => {
  it("passes WCAG AA body text for text-primary on surfaces in both themes", () => {
    const pairs = [
      [DARK["--color-text-primary"], DARK["--color-surface-base"]],
      [DARK["--color-text-primary"], DARK["--color-surface-raised"]],
      [DARK["--color-text-primary"], DARK["--color-surface-panel"]],
      [LIGHT["--color-text-primary"], LIGHT["--color-surface-base"]],
      [LIGHT["--color-text-primary"], LIGHT["--color-surface-raised"]],
      [LIGHT["--color-text-primary"], LIGHT["--color-surface-panel"]],
    ] as const;
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives the keyboard focus indicator at least 3:1 against adjacent surfaces", () => {
    const focusPairs = [
      [DARK["--color-text-primary"], DARK["--color-surface-base"]],
      [DARK["--color-text-primary"], DARK["--color-surface-raised"]],
      [DARK["--color-text-primary"], DARK["--color-surface-panel"]],
      [LIGHT["--color-text-primary"], LIGHT["--color-surface-base"]],
      [LIGHT["--color-text-primary"], LIGHT["--color-surface-raised"]],
      [LIGHT["--color-text-primary"], LIGHT["--color-surface-panel"]],
    ] as const;
    for (const [fg, bg] of focusPairs) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives field chrome placeholder AA contrast on surface-raised in both themes [D92] [D103]", () => {
    expect(
      contrastRatio(
        DARK["--color-text-secondary"],
        DARK["--color-surface-raised"],
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        LIGHT["--color-text-secondary"],
        LIGHT["--color-surface-raised"],
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("gives scrollbar thumb 3:1 against its track in both themes [D92] [D105]", () => {
    expect(
      contrastRatio(
        DARK["--color-text-secondary"],
        DARK["--color-surface-raised"],
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(
        LIGHT["--color-text-secondary"],
        LIGHT["--color-surface-raised"],
      ),
    ).toBeGreaterThanOrEqual(3);
  });
});
