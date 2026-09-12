import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createDayPlan,
  createFixedTaskBlock,
  createFlexibleTaskBlock,
} from "../calendar/index";
import { COPY as BOARD_COPY } from "../tasks/copy";
import { TaskBoardView, noopBoardHandlers } from "../tasks/TaskBoardView";
import { COPY as TIMELINE_COPY } from "../timeline/copy";
import { TimelineSurface } from "../timeline/TimelineSurface";
import { COPY as INSERT_COPY } from "../planning/copy";
import { InDayInsertion } from "../planning/InDayInsertion";
import { COPY as IMPORT_COPY } from "../import/copy";
import { ImportReviewView } from "../import/ImportReview";
import { buildReviewSession } from "../import/reviewState";
import { sampleEnvelope } from "../import/sampleEnvelope";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

const DAY = "2026-06-15";
const noon = new Date(2026, 5, 15, 12).getTime();

describe("drag equivalents [D6] [D14] [D22] [D28] [D83] [D92]", () => {
  it("Task Board reorder and live-column moves have labelled buttons", () => {
    expect(BOARD_COPY.moveUp).toBe("Move up");
    expect(BOARD_COPY.moveDown).toBe("Move down");
    expect(BOARD_COPY.moveToWaiting).toBe("Move to Waiting");
    expect(BOARD_COPY.moveToInProgress).toBe("Move to In Progress");
    expect(BOARD_COPY.moveToDeferred).toBe("Move to Deferred");
    const html = renderToStaticMarkup(
      createElement(TaskBoardView, {
        tasks: [
          {
            kind: "task",
            id: "t1",
            title: "Alpha",
            description: "A",
            subtasks: [],
            status: "Waiting",
            source: { kind: "user", accountId: "local" },
            createdAt: 1,
            updatedAt: 1,
            blockIds: [],
            focusHistory: [],
            liveOrder: 0,
          },
          {
            kind: "task",
            id: "t2",
            title: "Beta",
            description: "B",
            subtasks: [],
            status: "Waiting",
            source: { kind: "user", accountId: "local" },
            createdAt: 1,
            updatedAt: 1,
            blockIds: [],
            focusHistory: [],
            liveOrder: 1,
          },
        ],
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
    expect(html).toContain(BOARD_COPY.moveUp);
    expect(html).toContain(BOARD_COPY.moveDown);
    expect(html).toContain(BOARD_COPY.moveToInProgress);
    expect(html).toContain(BOARD_COPY.addToDayPlan);
    expect(html).toContain('draggable="true"');
  });

  it("timeline schedule, move, resize, unschedule, reorder, and chain move are labelled", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "flex",
        taskId: "t-a",
        day: DAY,
        durationMs: 60 * 60 * 1000,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
      createFixedTaskBlock({
        id: "meet",
        taskId: "t-meet",
        day: DAY,
        startMs: noon,
        endMs: noon + 60 * 60 * 1000,
      }),
    ]);
    const html = renderToStaticMarkup(
      createElement(TimelineSurface, {
        plan,
        tasks: [],
        now: noon,
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
        initialSelectedId: "flex",
      }),
    );
    expect(html).toContain(TIMELINE_COPY.moveBlock);
    expect(html).toContain(TIMELINE_COPY.resizeStart);
    expect(html).toContain(TIMELINE_COPY.resizeEnd);
    expect(html).toContain(TIMELINE_COPY.unschedule);
    expect(html).toContain(TIMELINE_COPY.moveEarlier);
    expect(html).toContain(TIMELINE_COPY.moveLater);
    expect(html).toContain(TIMELINE_COPY.moveToChain);
    expect(html).toContain(TIMELINE_COPY.dropUnschedule);
    expect(source("timeline/TaskTrayList.tsx")).toContain("scheduleOnTimeline");
  });

  it("insertion flow exposes every labelled action without requiring a drag", () => {
    const html = renderToStaticMarkup(
      createElement(InDayInsertion, {
        plan: createDayPlan(DAY),
        tasks: [],
        db: {} as never,
        planningDoc: null,
        onApply: () => undefined,
      }),
    );
    expect(html).toContain(INSERT_COPY.insertTitle);
    const open = source("planning/InDayInsertion.tsx");
    expect(open).toContain("COPY.pickTask");
    expect(open).toContain("COPY.newTask");
    expect(open).toContain("COPY.previewInsert");
    expect(open).toContain("COPY.confirmInsert");
    expect(open).toContain("COPY.cancel");
    expect(open).toContain("COPY.fixed");
    expect(open).toContain("COPY.flexible");
  });

  it("import file select is the non-drag equivalent of dropping a batch", () => {
    const html = renderToStaticMarkup(
      createElement(ImportReviewView, {
        session: buildReviewSession(sampleEnvelope(), []),
        online: true,
        loading: false,
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
    expect(html).toContain(IMPORT_COPY.moveUp);
    expect(html).toContain(IMPORT_COPY.moveDown);
    const boundary = source("import/ImportBoundary.tsx");
    expect(boundary).toContain('type="file"');
    expect(boundary).toContain("onDrop");
    expect(boundary).toContain("COPY.importBatch");
  });
});

describe("section E sweep [CURSOR-GOAL]", () => {
  it("product sources do not ship Streak, Challenge, Focus mode, or Category", () => {
    const skip = new Set([
      "a11y/sectionE.test.ts",
      "a11y/dragEquivalents.test.ts",
    ]);
    function walk(dir: string, files: string[] = []): string[] {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "a11y" && dir === root) {
            continue;
          }
          walk(path, files);
          continue;
        }
        if (
          /\.(ts|tsx|css)$/.test(entry.name) &&
          !entry.name.includes(".test.")
        ) {
          files.push(path);
        }
      }
      return files;
    }
    for (const file of walk(root)) {
      const rel = file.slice(root.length + 1).replaceAll("\\", "/");
      if (skip.has(rel)) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      expect(text, rel).not.toMatch(/\bStreak\b/);
      expect(text, rel).not.toMatch(/\bChallenge\b/);
      expect(text, rel).not.toMatch(/Focus mode/);
      expect(text, rel).not.toMatch(/\bCategory\b/);
    }
  });
});
