import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  conflictInfos,
  createDayPlan,
  createFixedReserveBlock,
  createFixedTaskBlock,
  createFlexibleTaskBlock,
  packDay,
  setRunningBlock,
} from "../calendar/index";
import { createTask } from "../domain/taskModel";
import { COPY as IMPORT_COPY } from "../import/copy";
import { ImportReviewView } from "../import/ImportReview";
import { buildReviewSession } from "../import/reviewState";
import { sampleEnvelope } from "../import/sampleEnvelope";
import { COPY as PLAN_COPY } from "../planning/copy";
import { COPY as POMODORO_COPY } from "../pomodoro/copy";
import { NowRail } from "../pomodoro/NowRail";
import { COPY as REPORTS_COPY } from "../reports/copy";
import { Reports } from "../shell/Reports";
import { ShellView } from "../shell/AppShell";
import { DEFAULT_DESK_MODE, DEFAULT_DESTINATION } from "../shell/destinations";
import { DEFAULT_THEME } from "../shell/theme";
import { COPY as BOARD_COPY } from "../tasks/copy";
import { noopBoardHandlers, TaskBoardView } from "../tasks/TaskBoardView";
import { COPY as TIMELINE_COPY } from "../timeline/copy";
import { TimelineSurface } from "../timeline/TimelineSurface";
import { StatusMark } from "../ui/StatusMark";
import { TimeBlock } from "../ui/TimeBlock";
import { TASK_STATUSES } from "../ui/types";
import { CONFORMANCE_CLAIM, MAIN_CONTENT_ID, SKIP_TO_MAIN } from "./checklist";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repo = join(here, "..", "..");

function source(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

const DAY = "2026-06-15";
const noon = new Date(2026, 5, 15, 12).getTime();
const hour = 60 * 60 * 1000;
const account = { kind: "user" as const, accountId: "local" };

function task(id: string, title: string) {
  return createTask({ id, title, now: noon, source: account }).task;
}

function shell(
  destination: "Daily Desk" | "Plan Tomorrow" | "Reports",
): string {
  return renderToStaticMarkup(
    createElement(ShellView, {
      destination,
      mode: DEFAULT_DESK_MODE,
      theme: DEFAULT_THEME,
      trayCollapsed: false,
      onDestination: () => undefined,
      onMode: () => undefined,
      onTheme: () => undefined,
      onTrayCollapsed: () => undefined,
    }),
  );
}

describe("document language, title, skip [D92]", () => {
  it("sets html lang en, titles the page Workie, and skips to main", () => {
    const htmlDoc = readFileSync(join(repo, "index.html"), "utf8");
    expect(htmlDoc).toMatch(/<html lang="en"/);
    expect(htmlDoc).toContain("<title>Workie</title>");
    const desk = shell(DEFAULT_DESTINATION);
    expect(desk.indexOf(SKIP_TO_MAIN)).toBeLessThan(desk.indexOf("Workie"));
    expect(desk).toContain(`href="#${MAIN_CONTENT_ID}"`);
    expect(desk).toContain(`id="${MAIN_CONTENT_ID}"`);
    expect(source("main.tsx")).toContain("./a11y/a11y.css");
  });
});

describe("system-state reference set [D23] [D37] [D63] [D91]", () => {
  it("keeps empty Task Board, Reports loading, failed import, awaiting reconciliation, and planning offline", () => {
    const emptyBoard = renderToStaticMarkup(
      createElement(TaskBoardView, {
        tasks: [],
        occurrences: [],
        statusHistory: [],
        blocks: [],
        now: noon,
        online: true,
        loading: false,
        formOpen: false,
        detailEntityId: null,
        confirming: null,
        partialFailures: {},
        onClose: () => undefined,
        onOpenForm: () => undefined,
        onCloseForm: () => undefined,
        onCloseDetail: () => undefined,
        onCreated: () => undefined,
        handlers: noopBoardHandlers(),
      }),
    );
    expect(emptyBoard).toContain('data-state="empty"');
    expect(emptyBoard).toContain(BOARD_COPY.emptyStep);

    const reports = renderToStaticMarkup(createElement(Reports));
    expect(reports).toContain(REPORTS_COPY.loading);
    expect(reports).toContain("reports-skeleton");
    expect(source("reports/reports.css")).not.toMatch(/@keyframes/);

    const failedImport = renderToStaticMarkup(
      createElement(ImportReviewView, {
        session: buildReviewSession(sampleEnvelope(), []),
        online: true,
        loading: false,
        error: `Task item-1: title is required. ${IMPORT_COPY.commitRecovery}`,
        discardConfirming: false,
        committing: false,
        onTitle: () => undefined,
        onDescription: () => undefined,
        onSelect: () => undefined,
        onAddAnyway: () => undefined,
        onCompare: () => undefined,
        onMove: () => undefined,
        onAddSubtask: () => undefined,
        onEditSubtask: () => undefined,
        onRemoveSubtask: () => undefined,
        onConfirm: () => undefined,
        onDiscard: () => undefined,
        onKeepReview: () => undefined,
        onConfirmDiscard: () => undefined,
      }),
    );
    expect(failedImport).toContain(IMPORT_COPY.commitRecovery);
    expect(failedImport).toContain('role="alert"');
    expect(failedImport).toContain(IMPORT_COPY.reviewTitle);

    const nowRail = source("pomodoro/NowRail.tsx");
    expect(nowRail).toContain('unfinished.state === "awaiting task selection"');
    expect(nowRail).toContain('data-testid="now-task"');
    expect(nowRail).toContain("COPY.awaitingReconciliation");
    expect(nowRail).toContain("COPY.countFocus");
    expect(nowRail).toContain("COPY.countPause");
    expect(nowRail).toContain("COPY.confirmInterrupt");
    expect(nowRail).toContain("COPY.previewSound");
    expect(POMODORO_COPY.awaitingReconciliation).toBe(
      "Awaiting reconciliation",
    );
    expect(POMODORO_COPY.previewSound).toBe("Preview sound");

    const planning = source("shell/PlanTomorrow.tsx");
    expect(planning).toContain("OfflineIcon");
    expect(planning).toContain("COPY.offline");
    expect(planning).toContain("data-offline");
    expect(planning).toContain("saveLabel");
    expect(PLAN_COPY.savedLocally).toBe("Draft saved on this device");
    expect(PLAN_COPY.offline).toBe("Offline");
  });

  it("never uses an endless sprite for loading", () => {
    expect(source("planning/planning.css")).toMatch(
      /animation:\s*plan-peak[^;]* 1;/,
    );
    expect(source("pomodoro/now.css")).toMatch(/animation:\s*now-peak[^;]* 1;/);
    expect(source("tasks/taskBoard.css")).toMatch(
      /animation:\s*task-complete-peak[^;]* 1;/,
    );
    expect(source("reports/reports.css")).not.toMatch(/animation:/);
    expect(source("planning/planning.css")).toContain("plan-skeleton-group");
  });
});

describe("identity signs and busy-day baseline [D73] [D85] [D92] [D94]", () => {
  it("puts at least two identity signs on each destination while primary stays obvious", () => {
    const desk = shell("Daily Desk");
    const plan = shell("Plan Tomorrow");
    const reports = shell("Reports");
    for (const html of [desk, plan, reports]) {
      const signs = [
        html.includes("type-display-xl") || html.includes("type-display-l"),
        html.includes("ui-ornament"),
        html.includes("Workie"),
      ];
      expect(signs.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    }
    expect(desk).toContain('data-primary-slot="daily-desk"');
    expect(plan).toContain('data-primary-slot="plan-tomorrow"');
    expect(reports).not.toContain("data-primary-slot");
    expect(reports).not.toMatch(/data-variant="primary"/);
    expect(CONFORMANCE_CLAIM).toContain("not a full-application AAA claim");
  });

  it("lets a busy day find the current task, conflict, and labels without colour alone", () => {
    const tasks = Array.from({ length: 30 }, (_, index) =>
      task(`t-${index}`, `Busy task ${index}`),
    );
    const plan = setRunningBlock(
      createDayPlan(DAY, [
        createFlexibleTaskBlock({
          id: "chain-a",
          taskId: "t-0",
          day: DAY,
          durationMs: 3 * hour,
          chainPosition: 0,
          precedingAnchorId: null,
        }),
        createFixedTaskBlock({
          id: "anchor",
          taskId: "t-1",
          day: DAY,
          startMs: noon - 10 * hour,
          endMs: noon - 9 * hour,
        }),
        createFixedReserveBlock({
          id: "buffer",
          day: DAY,
          startMs: noon,
          endMs: noon + hour,
        }),
        createFlexibleTaskBlock({
          id: "chain-b",
          taskId: "t-2",
          day: DAY,
          durationMs: hour,
          chainPosition: 1,
          precedingAnchorId: null,
        }),
      ]),
      "chain-a",
    );
    expect(conflictInfos(packDay(plan)).length).toBeGreaterThan(0);
    const timeline = renderToStaticMarkup(
      createElement(TimelineSurface, {
        plan,
        tasks,
        now: noon - 10.5 * hour,
        loadState: "ready",
        errorCause: null,
        offline: false,
        saveLabel: TIMELINE_COPY.savedLocally,
        preview: null,
        partialFailures: {},
        onPropose: () => undefined,
        onApply: () => undefined,
        onCancel: () => undefined,
        onRetry: () => undefined,
        onMarkRunning: () => undefined,
        initialSelectedId: "chain-a",
      }),
    );
    expect(timeline).toContain("Busy task 0");
    expect(timeline).toContain(TIMELINE_COPY.conflict);
    expect(timeline).toContain("ui-conflict-pattern");
    expect(timeline).toContain('data-running="true"');
    expect(timeline).toContain("Fixed");
    expect(timeline).toContain("Flexible");
    expect(timeline).toContain(TIMELINE_COPY.moveToChain);

    const board = renderToStaticMarkup(
      createElement(TaskBoardView, {
        tasks,
        occurrences: [],
        statusHistory: [],
        blocks: [],
        now: noon,
        online: true,
        loading: false,
        formOpen: false,
        detailEntityId: null,
        confirming: null,
        partialFailures: {},
        onClose: () => undefined,
        onOpenForm: () => undefined,
        onCloseForm: () => undefined,
        onCloseDetail: () => undefined,
        onCreated: () => undefined,
        handlers: noopBoardHandlers(),
      }),
    );
    expect(board).toContain("Busy task 29");
    expect(board).toContain(BOARD_COPY.createTask);
    expect((board.match(/data-variant="primary"/g) ?? []).length).toBe(1);

    const nowRail = renderToStaticMarkup(
      createElement(NowRail, {
        now: noon,
        tasks,
        plan,
        offline: true,
      }),
    );
    expect(nowRail).toContain(POMODORO_COPY.offline);
    expect(nowRail).toContain('data-icon="offline"');
    expect(nowRail).toContain(POMODORO_COPY.mutedNote);
    expect(nowRail).toContain(POMODORO_COPY.previewSound);
    expect(nowRail).toContain(POMODORO_COPY.savedLocally);
  });

  it("keeps four outcomes, fixed versus flexible, and conflict distinguishable by label and icon", () => {
    for (const status of TASK_STATUSES) {
      const html = renderToStaticMarkup(createElement(StatusMark, { status }));
      expect(html).toContain(`>${status}<`);
      expect(html).toContain("data-icon=");
    }
    const outcomes = [
      "Deferred",
      "Completed",
      "Abandoned",
      "Cancelled",
    ] as const;
    for (const status of outcomes) {
      const html = renderToStaticMarkup(createElement(StatusMark, { status }));
      expect(html).toContain(status);
    }
    const fixed = renderToStaticMarkup(
      createElement(TimeBlock, {
        status: "Waiting",
        blockType: "fixed",
        title: "Anchor",
      }),
    );
    const flexible = renderToStaticMarkup(
      createElement(TimeBlock, {
        status: "In Progress",
        blockType: "flexible",
        title: "Chain",
        conflict: true,
      }),
    );
    expect(fixed).toContain("Fixed");
    expect(fixed).toContain('data-edge="solid"');
    expect(flexible).toContain("Flexible");
    expect(flexible).toContain('data-edge="stepped-dashed"');
    expect(flexible).toContain("Conflict");
    expect(flexible).toContain("ui-conflict-pattern");
  });
});

describe("motion, sound, and high contrast [D89] [D90] [D92]", () => {
  it("honours reduced motion on the three ritual peaks", () => {
    const planCss = source("planning/planning.css");
    const nowCss = source("pomodoro/now.css");
    const boardCss = source("tasks/taskBoard.css");
    const tokens = source("styles/tokens.css");
    expect(planCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(nowCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(boardCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokens).toContain("--duration-ritual: 0ms");
    expect(source("planning/copy.ts")).toContain(PLAN_COPY.skipFlourish);
    expect(source("pomodoro/copy.ts")).toContain(POMODORO_COPY.skipFlourish);
    expect(source("tasks/copy.ts")).toContain(BOARD_COPY.skipFlourish);
  });

  it("keeps muted events labelled and offers a sound preview", () => {
    expect(POMODORO_COPY.mutedNote).toBe("Events stay readable while muted.");
    expect(POMODORO_COPY.previewSound).toBe("Preview sound");
    expect(source("pomodoro/NowRail.tsx")).toContain("playCueBestEffort(true)");
    expect(source("pomodoro/NowRail.tsx")).toContain("COPY.soundOptIn");
  });
});
