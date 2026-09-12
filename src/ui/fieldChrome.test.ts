import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileControl } from "./FileControl";
import { ORNAMENT_TIERS } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");
const repoRoot = join(srcRoot, "..");

const fieldChromeCss = readFileSync(join(here, "fieldChrome.css"), "utf8");
const primitivesCss = readFileSync(join(here, "primitives.css"), "utf8");
const tokensCss = readFileSync(join(srcRoot, "styles", "tokens.css"), "utf8");

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (
      entry === "node_modules" ||
      entry === "dist" ||
      entry === "playwright-report" ||
      entry === "test-results"
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

describe("field chrome concept [D103]", () => {
  it("keeps the five primitives and does not add a sixth", () => {
    expect(ORNAMENT_TIERS).toEqual(["shell", "panel", "dense"]);
    expect(primitivesCss).toMatch(/\.ui-button/);
    expect(primitivesCss).toMatch(/\.ui-task-card/);
    expect(primitivesCss).toMatch(/\.ui-time-block/);
    expect(primitivesCss).toMatch(/\.ui-panel/);
    expect(primitivesCss).toMatch(/\.ui-progress-status/);
    expect(fieldChromeCss).toMatch(
      /Shared field chrome[\s\S]*A Concept, not a primitive/,
    );
    expect(fieldChromeCss).not.toMatch(/data-primitive="field"/);
  });

  it("sets appearance none on the seven native controls", () => {
    expect(fieldChromeCss).toMatch(/appearance:\s*none/);
    expect(fieldChromeCss).toMatch(/-webkit-appearance:\s*none/);
    for (const control of [
      'input[type="text"]',
      "textarea",
      "select",
      'input[type="checkbox"]',
      'input[type="radio"]',
      'input[type="number"]',
      'input[type="file"]',
    ]) {
      expect(fieldChromeCss).toContain(control);
    }
  });

  it("uses the dense tier frame without clipping text or hit area", () => {
    expect(fieldChromeCss).toContain("var(--chamfer-4)");
    expect(fieldChromeCss).toContain("var(--border-1)");
    expect(fieldChromeCss).toContain("var(--elevation-offset)");
    expect(fieldChromeCss).toContain("var(--field-chrome-border)");
    expect(fieldChromeCss).not.toMatch(
      /input\[type="text"\][^}]*clip-path:\s*polygon/,
    );
    expect(fieldChromeCss).toMatch(/overflow:\s*visible/);
  });

  it("uses content density heights of 32px compact and 44px touch", () => {
    expect(fieldChromeCss).toContain("var(--field-chrome-size-compact)");
    expect(fieldChromeCss).toContain("var(--field-chrome-size-touch)");
    expect(fieldChromeCss).toContain("var(--space-content-8)");
  });

  it("styles placeholder from text-secondary and never as a label replacement", () => {
    expect(fieldChromeCss).toMatch(
      /::placeholder[\s\S]*color:\s*var\(--field-chrome-placeholder\)/,
    );
  });

  it("sets accent-color from field chrome tokens, never a [D86] hue", () => {
    expect(fieldChromeCss).toMatch(
      /accent-color:\s*var\(--field-chrome-accent\)/,
    );
    expect(fieldChromeCss).not.toMatch(/accent-color:\s*var\(--color-status/);
    expect(fieldChromeCss).not.toMatch(
      /--_tick-image:[\s\S]*color-status-(waiting|in-progress|deferred|completed|abandoned|cancelled|conflict)/,
    );
    expect(tokensCss).toMatch(
      /--field-chrome-accent:\s*var\(--color-text-primary\)/,
    );
  });

  it("keeps the shared focus indicator and does not clip it", () => {
    expect(fieldChromeCss).toMatch(
      /outline:\s*var\(--focus-outline-width\)\s+solid\s+var\(--color-focus\)/,
    );
    expect(fieldChromeCss).toMatch(
      /outline-offset:\s*var\(--focus-outline-offset\)/,
    );
  });

  it("marks invalid with aria-invalid styling, not colour alone", () => {
    expect(fieldChromeCss).toContain('[aria-invalid="true"]');
  });

  it("disables with reduced contrast plus a non-colour hatch", () => {
    expect(fieldChromeCss).toMatch(/repeating-linear-gradient/);
    expect(fieldChromeCss).toMatch(/cursor:\s*not-allowed/);
    expect(fieldChromeCss).toMatch(/--_fill:\s*var\(--color-surface-panel\)/);
  });
});

describe("container chrome [D105] [D106] [D107]", () => {
  it("tints Workie scroll containers from field chrome tokens and sets no scrollbar width", () => {
    expect(fieldChromeCss).toMatch(
      /scrollbar-color:\s*var\(--field-chrome-scrollbar-thumb\)/,
    );
    expect(fieldChromeCss).toContain(".task-board-layer");
    expect(fieldChromeCss).toContain(".import-review-layer");
    expect(fieldChromeCss).toContain(".timeline-scroll");
    expect(fieldChromeCss).toMatch(
      /forced-colors:\s*active[\s\S]*scrollbar-color:\s*auto/,
    );
    expect(fieldChromeCss).not.toMatch(/scrollbar-width/);
  });

  it("forbids webkit scrollbar, overlay, thin, and none across the build", () => {
    const forbiddenWebkit = ["::", "-webkit-scrollbar"].join("");
    const files = walkFiles(join(repoRoot, "src")).concat(
      walkFiles(join(repoRoot, "e2e")),
    );
    for (const file of files) {
      if (!/\.(css|tsx|ts|html)$/.test(file)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain(forbiddenWebkit);
      expect(source).not.toMatch(/scrollbar-width:\s*(thin|none)/);
    }
  });

  it("hides the browser details marker and draws a quiet dense-tier mark", () => {
    expect(fieldChromeCss).toMatch(/::-webkit-details-marker/);
    expect(fieldChromeCss).toMatch(/list-style:\s*none/);
    expect(fieldChromeCss).toMatch(
      /details > summary::before[\s\S]*background:\s*var\(--field-chrome-mark\)/,
    );
    expect(fieldChromeCss).not.toMatch(
      /details[\s\S]{0,400}--color-status-(waiting|in-progress|deferred|completed|abandoned|cancelled|conflict)/,
    );
  });

  it("drops fieldset groove, padding, and margin", () => {
    expect(fieldChromeCss).toMatch(
      /fieldset\s*\{[\s\S]*margin:\s*0;[\s\S]*padding:\s*0;[\s\S]*border:\s*0;/,
    );
    expect(fieldChromeCss).toMatch(/fieldset\s*\{[\s\S]*display:\s*grid;/);
  });
});

describe("file control [D103] [D104]", () => {
  it("keeps a native file input that is not a visible control", () => {
    const html = renderToStaticMarkup(
      createElement(FileControl, {
        id: "batch-file",
        label: "Batch file",
      }),
    );
    expect(html).toContain('type="file"');
    expect(html).toContain("Batch file");
    expect(html).toContain('for="batch-file-trigger"');
    expect(html).toContain("ui-file-native");
    expect(html).toContain("Choose file");
    expect(html).toContain("No file selected.");
    expect(html).not.toContain("No file chosen");
  });
});
