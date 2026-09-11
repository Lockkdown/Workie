import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Panel } from "./Panel";
import {
  CONTRIBUTION_LEVELS,
  ContributionLegend,
  ProgressStatus,
} from "./ProgressStatus";
import { StatusMark } from "./StatusMark";
import { TaskCard } from "./TaskCard";
import { TimeBlock } from "./TimeBlock";
import {
  ORNAMENT_TIERS,
  TASK_STATUSES,
  statusSlug,
  type TaskStatus,
} from "./types";

const primitivesCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "primitives.css"),
  "utf8",
);

function render(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

describe("ornament tiers", () => {
  it("expresses shell, panel, and dense on a primitive", () => {
    for (const tier of ORNAMENT_TIERS) {
      const html = render(
        createElement(Button, { ornament: tier, children: "Continue" }),
      );
      expect(html).toContain(`data-ornament="${tier}"`);
      expect(html).toContain("Continue");
    }
  });

  it("never covers text or resizes data by ornament", () => {
    expect(primitivesCss).toMatch(
      /\.ui-ornament::before[\s\S]*pointer-events:\s*none/,
    );
    expect(primitivesCss).toMatch(/\.ui-ornament-content[\s\S]*z-index:\s*1/);
    expect(primitivesCss).toMatch(/\.ui-ornament[\s\S]*overflow:\s*visible/);
    const ornamentRules = primitivesCss.match(
      /\.ui-ornament\[data-ornament="(?:shell|panel|dense)"\]\s*\{[^}]+\}/g,
    );
    expect(ornamentRules?.length).toBe(3);
    for (const rule of ornamentRules ?? []) {
      expect(rule).not.toMatch(/font-size/);
      expect(rule).not.toMatch(/width:\s*\d/);
      expect(rule).not.toMatch(/height:\s*\d/);
    }
  });

  it("cuts chamfers from the frame only", () => {
    expect(primitivesCss).toMatch(
      /\.ui-ornament::before[\s\S]*clip-path:\s*polygon/,
    );
    expect(primitivesCss).not.toMatch(/\.ui-button\s*\{[^}]*clip-path/);
    expect(primitivesCss).not.toMatch(/\.ui-task-card\s*\{[^}]*clip-path/);
    expect(primitivesCss).toMatch(/box-shadow:\s*var\(--elevation-offset\)/);
  });
});

describe("state encoding", () => {
  it("always carries a visible canonical label, icon, and accent", () => {
    const states = [...TASK_STATUSES, "Conflict"] as const;
    for (const status of states) {
      const html = render(createElement(StatusMark, { status }));
      expect(html).toContain(`>${status}<`);
      expect(html).toContain(`data-icon="${statusSlug(status)}"`);
      expect(html).toContain(`data-status="${statusSlug(status)}"`);
    }
  });

  it("does not use brand coral or mint as semantic colour", () => {
    expect(primitivesCss).toMatch(
      /--color-status:\s*var\(--color-status-waiting\)/,
    );
    expect(primitivesCss).toMatch(
      /--color-status:\s*var\(--color-status-in-progress\)/,
    );
    expect(primitivesCss).not.toMatch(/\.ui-status-mark[^}]*brand-coral/);
    expect(primitivesCss).not.toMatch(/\.ui-status-mark[^}]*brand-mint/);
    expect(primitivesCss).not.toMatch(
      /\.ui-task-card\s*\{[^}]*background:\s*var\(--color-status/,
    );
  });
});

describe("five primitives", () => {
  it("renders a button with primary 44px and compact 24px targets", () => {
    const primary = render(
      createElement(Button, {
        variant: "primary",
        size: "primary",
        children: "Confirm",
      }),
    );
    const compact = render(
      createElement(Button, {
        variant: "secondary",
        size: "compact",
        children: "Edit",
      }),
    );
    expect(primary).toContain('data-variant="primary"');
    expect(primary).toContain('data-size="primary"');
    expect(compact).toContain('data-size="compact"');
    expect(primitivesCss).toMatch(
      /\.ui-button\[data-size="primary"\]\s*\{[^}]*min-width:\s*var\(--target-primary\)/,
    );
    expect(primitivesCss).toMatch(
      /\.ui-button\[data-size="primary"\]\s*\{[^}]*min-height:\s*var\(--target-primary\)/,
    );
    expect(primitivesCss).toMatch(
      /\.ui-button\[data-size="compact"\]\s*\{[^}]*min-width:\s*var\(--target-compact\)/,
    );
    expect(primitivesCss).toMatch(
      /\.ui-button\[data-size="compact"\]\s*\{[^}]*min-height:\s*var\(--target-compact\)/,
    );
    expect(primitivesCss).toMatch(
      /\.ui-compact-cluster\s*\{[^}]*gap:\s*var\(--space-structure-24\)/,
    );
  });

  it("renders task cards with Inter titles and status signals", () => {
    const html = render(
      createElement(TaskCard, {
        status: "Waiting",
        title: "Sample task title",
        ornament: "dense",
      }),
    );
    expect(html).toContain("Sample task title");
    expect(html).toContain("type-body-m");
    expect(html).toContain("Waiting");
    expect(html).toContain('data-icon="waiting"');
    expect(html).toContain("ui-accent-strip");
  });

  it("distinguishes fixed and flexible blocks without extra hues", () => {
    const fixed = render(
      createElement(TimeBlock, {
        status: "Waiting" satisfies TaskStatus,
        blockType: "fixed",
        title: "Morning block",
      }),
    );
    const flexible = render(
      createElement(TimeBlock, {
        status: "In Progress",
        blockType: "flexible",
        title: "Afternoon chain",
        conflict: true,
      }),
    );
    expect(fixed).toContain("Fixed");
    expect(fixed).toContain('data-icon="anchor"');
    expect(fixed).toContain('data-edge="solid"');
    expect(flexible).toContain("Flexible");
    expect(flexible).toContain('data-icon="chain"');
    expect(flexible).toContain('data-edge="stepped-dashed"');
    expect(flexible).toContain("Conflict");
    expect(flexible).toContain("ui-conflict-pattern");
    expect(primitivesCss).toMatch(/\.ui-time-block\[data-block-type="fixed"\]/);
    expect(primitivesCss).toMatch(
      /\.ui-time-block\[data-block-type="flexible"\]/,
    );
    expect(primitivesCss).not.toMatch(
      /\.ui-time-block\[data-block-type="fixed"\]\s*\{[^}]*--color-brand/,
    );
  });

  it("renders panel and dialog primitives", () => {
    const panel = render(
      createElement(Panel, {
        title: "Panel",
        ornament: "panel",
        children: "Body",
      }),
    );
    const dialog = render(
      createElement(Panel, {
        title: "Dialog",
        ornament: "panel",
        role: "dialog",
        children: "Body",
      }),
    );
    expect(panel).toContain("Panel");
    expect(panel).toContain('data-kind="panel"');
    expect(panel).toContain("type-display-l");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain("type-body-l");
    expect(dialog).toContain("Dialog");
  });

  it("renders progress, status, and a contribution legend", () => {
    const progress = render(
      createElement(ProgressStatus, {
        status: "In Progress",
        value: 40,
      }),
    );
    const legend = render(createElement(ContributionLegend));
    expect(progress).toContain("In Progress");
    expect(progress).toContain('role="progressbar"');
    expect(progress).toContain("40%");
    expect(legend).toContain("Legend");
    for (const level of CONTRIBUTION_LEVELS) {
      expect(legend).toContain(`>${level === "4+" ? "4+" : String(level)}<`);
    }
    expect(legend).toContain('data-level="4plus"');
  });

  it("never clips the keyboard focus indicator with ornament", () => {
    expect(primitivesCss).toMatch(/\.ui-button:focus-visible/);
    expect(primitivesCss).toMatch(
      /outline:\s*var\(--focus-outline-width\)\s+solid\s+var\(--color-focus\)/,
    );
    expect(primitivesCss).toMatch(
      /outline-offset:\s*var\(--focus-outline-offset\)/,
    );
    expect(primitivesCss).toMatch(/\.ui-ornament[\s\S]*overflow:\s*visible/);
  });
});
