import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY as PLAN_COPY } from "../planning/copy";
import { COPY as POMODORO_COPY } from "../pomodoro/copy";
import { COPY as BOARD_COPY } from "../tasks/copy";
import { noopBoardHandlers, TaskBoardView } from "../tasks/TaskBoardView";
import { Button } from "./Button";
import { Panel } from "./Panel";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

const primitivesCss = readFileSync(join(here, "primitives.css"), "utf8");
const fieldChromeCss = readFileSync(join(here, "fieldChrome.css"), "utf8");
const planningCss = readFileSync(
  join(srcRoot, "planning", "planning.css"),
  "utf8",
);
const nowCss = readFileSync(join(srcRoot, "pomodoro", "now.css"), "utf8");
const boardCss = readFileSync(join(srcRoot, "tasks", "taskBoard.css"), "utf8");
const timelineCss = readFileSync(
  join(srcRoot, "timeline", "timeline.css"),
  "utf8",
);
const tokensCss = readFileSync(join(srcRoot, "styles", "tokens.css"), "utf8");
const importCss = readFileSync(join(srcRoot, "import", "import.css"), "utf8");
const shellCss = readFileSync(join(srcRoot, "shell", "shell.css"), "utf8");
const reportsCss = readFileSync(
  join(srcRoot, "reports", "reports.css"),
  "utf8",
);

function walkCss(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkCss(full, acc);
    } else if (full.endsWith(".css")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("ritual peaks consume [D89] tokens", () => {
  it("caps every ritual at --duration-ritual and never hardcodes 700ms", () => {
    expect(tokensCss).toMatch(/--duration-ritual:\s*600ms/);
    expect(planningCss).toMatch(
      /animation:\s*plan-peak var\(--duration-ritual\) var\(--easing-pixel\) 1;/,
    );
    expect(nowCss).toMatch(
      /animation:\s*now-peak var\(--duration-ritual\) var\(--easing-pixel\) 1;/,
    );
    expect(boardCss).toMatch(
      /animation:\s*task-complete-peak var\(--duration-ritual\) var\(--easing-pixel\) 1;/,
    );
    for (const css of [planningCss, nowCss, boardCss, primitivesCss]) {
      expect(css).not.toMatch(/700ms/);
    }
  });

  it("uses --easing-pixel on pixel flourishes and --easing-move on positional movement", () => {
    expect(planningCss).toContain("var(--easing-pixel)");
    expect(nowCss).toContain("var(--easing-pixel)");
    expect(boardCss).toContain("var(--easing-pixel)");
    expect(timelineCss).toContain("var(--easing-move");
    expect(boardCss).toMatch(
      /\.task-board-card\s*\{[^}]*var\(--easing-move\)/s,
    );
    expect(primitivesCss).toMatch(/\.ui-panel\s*\{[^}]*var\(--easing-move\)/s);
  });

  it("deletes the dead .ui-ritual consumer", () => {
    expect(primitivesCss).not.toMatch(/\.ui-ritual\b/);
  });

  it("keeps each peak skippable with the same end state after skip [D89]", () => {
    const boardProps = {
      tasks: [],
      occurrences: [],
      statusHistory: [],
      blocks: [],
      now: 0,
      loading: false,
      online: true,
      formOpen: false,
      detailEntityId: null,
      confirming: null,
      partialFailures: {},
      onSkipFlourish: () => undefined,
      onClose: () => undefined,
      onOpenForm: () => undefined,
      onCloseForm: () => undefined,
      onCloseDetail: () => undefined,
      onCreated: () => undefined,
      handlers: noopBoardHandlers(),
    };
    const withFlourish = renderToStaticMarkup(
      createElement(TaskBoardView, { ...boardProps, flourish: true }),
    );
    const skipped = renderToStaticMarkup(
      createElement(TaskBoardView, { ...boardProps, flourish: false }),
    );
    expect(withFlourish).toContain(BOARD_COPY.skipFlourish);
    expect(withFlourish).toContain('data-ritual="complete"');
    expect(skipped).not.toContain(BOARD_COPY.skipFlourish);
    expect(skipped).toContain(BOARD_COPY.boardTitle);
    expect(PLAN_COPY.skipFlourish).toBe("Skip animation");
    expect(POMODORO_COPY.skipFlourish).toBe("Skip animation");
  });
});

describe("panel, micro, and field motion [D89] [D103] [D109]", () => {
  it("runs panel and dialog entry at --duration-panel", () => {
    const panel = renderToStaticMarkup(
      createElement(Panel, { title: "Panel", children: "Body" }),
    );
    const dialog = renderToStaticMarkup(
      createElement(Panel, {
        title: "Dialog",
        role: "dialog",
        children: "Body",
      }),
    );
    expect(panel).toContain("ui-panel");
    expect(dialog).toContain('data-kind="dialog"');
    expect(primitivesCss).toMatch(
      /\.ui-panel\s*\{[^}]*animation:\s*panel-enter var\(--duration-panel\) var\(--easing-move\) 1;/s,
    );
    expect(primitivesCss).toContain("@keyframes panel-enter");
  });

  it("covers hover, press, and focus on every button tier with filter, not colour alone", () => {
    for (const variant of ["primary", "secondary", "quiet"] as const) {
      const html = renderToStaticMarkup(
        createElement(Button, { variant, children: variant }),
      );
      expect(html).toContain(`data-variant="${variant}"`);
    }
    expect(primitivesCss).toMatch(
      /\.ui-button\s*\{[^}]*filter var\(--duration-micro\) var\(--easing-move\)/s,
    );
    expect(primitivesCss).toMatch(/\.ui-button:hover\s*\{[^}]*filter:/s);
    expect(primitivesCss).toMatch(/\.ui-button:active\s*\{[^}]*filter:/s);
    expect(primitivesCss).toMatch(
      /\.ui-button\s*\{[^}]*outline-offset var\(--duration-micro\)/s,
    );
  });

  it("gives the seven field controls a micro focus transition", () => {
    expect(fieldChromeCss).toMatch(
      /outline-color var\(--duration-micro\) var\(--easing-move\)/,
    );
    expect(fieldChromeCss).toMatch(
      /outline-offset var\(--duration-micro\) var\(--easing-move\)/,
    );
  });
});

describe("dense areas stay still [D74] [D89]", () => {
  it("runs no idle or looping animation on dense or data surfaces", () => {
    for (const file of walkCss(srcRoot)) {
      const css = readFileSync(file, "utf8");
      expect(css, file).not.toMatch(
        /animation(?:-iteration-count)?:[^;]*infinite/,
      );
      expect(css, file).not.toMatch(
        /animation-iteration-count:\s*(?:2|[3-9]|\d{2,})/,
      );
    }
    expect(reportsCss).not.toMatch(/animation:/);
    expect(importCss).not.toMatch(/animation:/);
    expect(shellCss).not.toMatch(/animation:/);
  });

  it("keeps ritual and panel animations to a single play", () => {
    expect(planningCss).toMatch(/plan-peak[^;]* 1;/);
    expect(nowCss).toMatch(/now-peak[^;]* 1;/);
    expect(boardCss).toMatch(/task-complete-peak[^;]* 1;/);
    expect(primitivesCss).toMatch(/panel-enter[^;]* 1;/);
  });
});

describe("prefers-reduced-motion [D89]", () => {
  it("collapses ritual, panel, card, and block motion", () => {
    expect(tokensCss).toContain("--duration-ritual: 0ms");
    expect(tokensCss).toContain("--duration-panel: 0ms");
    expect(tokensCss).toContain("--duration-move: 0ms");
    expect(tokensCss).toContain("--duration-micro: 0ms");
    expect(tokensCss).toContain("--duration-opacity: 120ms");
    expect(planningCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(nowCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(boardCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(timelineCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(primitivesCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(planningCss).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{[^}]*\.plan-flourish[^}]*animation:\s*none/s,
    );
    expect(nowCss).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{[^}]*\.now-flourish[^}]*animation:\s*none/s,
    );
    expect(boardCss).toMatch(
      /prefers-reduced-motion: reduce\)[\s\S]*\.task-complete-flourish[\s\S]*animation:\s*none/,
    );
    expect(primitivesCss).toMatch(
      /prefers-reduced-motion: reduce\)[\s\S]*panel-enter var\(--duration-opacity\)/,
    );
    expect(timelineCss).toContain("--duration-opacity");
    expect(boardCss).toMatch(
      /prefers-reduced-motion: reduce\)[\s\S]*\.task-board-card[\s\S]*--duration-opacity/,
    );
  });
});
