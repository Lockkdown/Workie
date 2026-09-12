import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { FileControl } from "./FileControl";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");
const repoRoot = join(srcRoot, "..");

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

const BROWSER_STRINGS = [
  "No file chosen",
  "Choose File",
  "Chọn tệp",
  "Không có tệp nào được chọn",
  "Vui lòng điền vào trường này",
  "Please fill out this field",
] as const;

const OS_PROMISE = [
  /file picker[\s\S]{0,80}is English/i,
  /notification permission[\s\S]{0,80}is English/i,
  /leave-site[\s\S]{0,80}is English/i,
  /autofill[\s\S]{0,80}is English/i,
  /context menu[\s\S]{0,80}is English/i,
  /open <select>[\s\S]{0,80}is English/i,
] as const;

const DIALOG_CALL = /(?<![.\w])(?:alert|confirm|prompt)\s*\(/;
const WINDOW_DIALOG =
  /(?:window|globalThis|self|global)\s*\.\s*(?:alert|confirm|prompt)\s*\(/;

describe("no browser-supplied string [D78] [D104]", () => {
  it("keeps F1 invariant 17 across src: no native dialogs, no browser file strings", () => {
    const files = walkFiles(srcRoot).filter((file) =>
      /\.(ts|tsx|js|css|html)$/.test(file),
    );
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) {
        continue;
      }
      for (const phrase of BROWSER_STRINGS) {
        expect(source).not.toContain(phrase);
      }
      expect(source).not.toMatch(DIALOG_CALL);
      expect(source).not.toMatch(WINDOW_DIALOG);
      for (const pattern of OS_PROMISE) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it("does not promise OS chrome is English in product or tests", () => {
    const files = walkFiles(join(repoRoot, "e2e")).concat(
      walkFiles(join(repoRoot, "eslint-rules")),
    );
    for (const file of files) {
      if (!/\.(ts|tsx|js)$/.test(file)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      for (const pattern of OS_PROMISE) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it("beats T13 file chrome so the native input is not a visible control", () => {
    const css = readFileSync(join(here, "fileControl.css"), "utf8");
    expect(css).toContain('input.ui-file-native[type="file"]');
    expect(css).toContain("::file-selector-button");
    expect(css).toContain("clip-path: inset(50%)");
    expect(css).toContain("opacity: 0");
    expect(css).not.toMatch(/@import/);
  });

  it("hides the native file input and writes Workie English file copy", () => {
    const html = renderToStaticMarkup(
      createElement(FileControl, {
        id: "batch-file",
        label: "Batch file",
      }),
    );
    expect(html).toContain('type="file"');
    expect(html).toContain("ui-file-native");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(COPY.chooseFile);
    expect(html).toContain(COPY.noFileSelected);
    expect(html).not.toContain("No file chosen");
    expect(html).not.toContain("Choose File");
    expect(COPY.chooseFile).not.toBe("Choose File");
    expect(COPY.noFileSelected).not.toBe("No file chosen");
  });

  it("uses WorkieForm so every submitting form is noValidate", () => {
    for (const file of walkFiles(srcRoot).filter((entry) =>
      entry.endsWith(".tsx"),
    )) {
      if (file.endsWith("WorkieForm.tsx") || file.endsWith(".test.tsx")) {
        continue;
      }
      expect(readFileSync(file, "utf8")).not.toContain("<form");
    }
    expect(readFileSync(join(here, "WorkieForm.tsx"), "utf8")).toContain(
      "noValidate",
    );
  });
});
