import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createOccurrence, createTask, setBlockIds } from "../domain/taskModel";
import {
  abandon,
  cancel,
  complete,
  moveLiveStatus,
} from "../domain/transitions";
import type { Task } from "../domain/types";
import { workieDayKey } from "../domain/workieDay";
import { COPY } from "./copy";
import { TaskBoard } from "./TaskBoard";
import { noopBoardHandlers, TaskBoardView } from "./TaskBoardView";

const now = new Date(2026, 8, 12, 12, 0, 0, 0).getTime();
const source = { kind: "user" as const, accountId: "local" };
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "taskBoard.css"),
  "utf8",
);

function task(id: string, title: string, extras: Partial<Task> = {}): Task {
  const created = createTask({ id, title, now, source });
  return { ...created.task, ...extras };
}

function renderView(
  overrides: Partial<Parameters<typeof TaskBoardView>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(TaskBoardView, {
      tasks: [],
      occurrences: [],
      statusHistory: [],
      blocks: [],
      now,
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
      ...overrides,
    }),
  );
}

describe("TaskBoard surface [D81]", () => {
  it("renders nothing when closed and a dialog when open", () => {
    const closed = renderToStaticMarkup(
      createElement(TaskBoard, {
        open: false,
        onClose: () => undefined,
        onScheduleTask: () => undefined,
      }),
    );
    expect(closed).toBe("");
    const open = renderToStaticMarkup(
      createElement(TaskBoard, {
        open: true,
        onClose: () => undefined,
        onScheduleTask: () => undefined,
      }),
    );
    expect(open).toContain('role="dialog"');
    expect(open).toContain(COPY.boardTitle);
    expect(open).toContain('data-state="loading"');
    expect(open).not.toContain('aria-label="App"');
    expect(open).not.toContain("Kanban");
  });

  it("keeps four columns in the loading skeleton", () => {
    const html = renderView({ loading: true });
    expect(html).toContain('data-column="Waiting"');
    expect(html).toContain('data-column="In Progress"');
    expect(html).toContain('data-column="Deferred"');
    expect(html).toContain('data-column="Closed"');
    expect(html).toContain(">Waiting<");
    expect(html).toContain(">In Progress<");
    expect(html).toContain(">Deferred<");
    expect(html).toContain(">Closed<");
    expect(html).toContain(">Completed<");
    expect(html).toContain(">Abandoned<");
    expect(html).toContain(">Cancelled<");
    expect(html).toContain('data-state="loading"');
  });
});

describe("board columns and cards [D11] [D14] [D16]", () => {
  it("renders four columns, Closed subgroups, and always-on signals", () => {
    const waiting = task("w", "Waiting card", {
      description: "DETAIL_ONLY_DESC_XYZ",
      subtasks: [
        { id: "s1", title: "DETAIL_ONLY_SUB_XYZ", done: false },
        { id: "s2", title: "other", done: true },
      ],
    });
    const planned = setBlockIds(waiting, ["b1", "b2"], now);
    const progress = moveLiveStatus(
      task("p", "Doing"),
      "In Progress",
      now + 1,
      [],
    ).entity;
    const deferred = moveLiveStatus(
      task("d", "Later"),
      "Deferred",
      now + 1,
      [],
    ).entity;
    const done = complete(task("c", "Done"), now + 2, []).entity;
    const left = abandon(
      task("a", "Left"),
      { confirmed: true },
      now + 2,
      [],
    ).entity;
    const stopped = cancel(
      task("x", "Stopped"),
      { confirmed: true },
      now + 2,
      [],
    ).entity;
    const repeating = createTask({
      id: "rep",
      title: "Việc cần làm",
      now,
      source,
      repeatWeekdays: [6],
    }).task;
    const { occurrence } = createOccurrence({
      id: "occ",
      taskId: "rep",
      date: workieDayKey(now),
      now,
    });
    const html = renderView({
      tasks: [planned, progress, deferred, done, left, stopped, repeating],
      occurrences: [occurrence],
      blocks: [
        { id: "b1", startsAt: now + 60_000 },
        { id: "b2", startsAt: now + 120_000 },
      ],
    });
    expect(html).toContain('data-column="Waiting"');
    expect(html).toContain('data-subgroup="Completed"');
    expect(html).toContain('data-subgroup="Abandoned"');
    expect(html).toContain('data-subgroup="Cancelled"');
    expect(html).toContain("Waiting card");
    expect(html).toContain("Việc cần làm");
    expect(html).toContain(`${COPY.sourceCreator}: local`);
    expect(html).toContain(COPY.unscheduled);
    expect(html).toContain("+1 blocks");
    expect(html).toContain("1/2");
    expect(html).toContain(COPY.repeat);
    expect(html).toContain(workieDayKey(now));
    expect(html).not.toContain("DETAIL_ONLY_DESC_XYZ");
    expect(html).not.toContain("DETAIL_ONLY_SUB_XYZ");
    expect(html).toContain(COPY.moreActions);
    expect(html).not.toContain("•••");
    expect(html).toContain(COPY.complete);
    expect(html).toContain(COPY.abandon);
    expect(html).toContain(COPY.cancel);
    expect(html).toContain(COPY.addToDayPlan);
    expect(html).toContain(COPY.moveUp);
    expect(html).toContain(COPY.moveDown);
    expect(html).toContain(COPY.moveToInProgress);
    expect(html).toContain(COPY.moveToDeferred);
    expect(html).toContain('draggable="true"');
    expect(html).toContain(COPY.restore);
    expect(html).toContain('data-icon="waiting"');
    expect(html).toContain("type-body-m");
    expect(html).toContain("type-body-s");
  });

  it("keeps detail-only fields in TaskDetail", () => {
    const seeded = createTask({
      id: "w",
      title: "Open me",
      now,
      source,
      description: "DETAIL_ONLY_DESC_XYZ",
      subtasks: [{ id: "s1", title: "DETAIL_ONLY_SUB_XYZ", done: false }],
    });
    const withFocus = {
      ...seeded.task,
      focusHistory: ["session-detail"],
      blockIds: ["block-detail"],
    };
    const html = renderView({
      tasks: [withFocus],
      statusHistory: seeded.history,
      blocks: [{ id: "block-detail", startsAt: now + 1_000 }],
      detailEntityId: "w",
    });
    expect(html).toContain("DETAIL_ONLY_DESC_XYZ");
    expect(html).toContain("DETAIL_ONLY_SUB_XYZ");
    expect(html).toContain("session-detail");
    expect(html).toContain("block-detail");
    expect(html).toContain(COPY.historyHeading);
    expect(html).toContain(COPY.recurrenceHeading);
    expect(html).toContain(COPY.sourceHeading);
  });

  it("shows abandon/cancel confirmation copy", () => {
    const waiting = task("w", "Confirm me");
    const html = renderView({
      tasks: [waiting],
      confirming: { entityId: "w", action: "abandon" },
    });
    expect(html).toContain(COPY.abandonConfirm);
    expect(html).toContain(COPY.confirmAbandon);
    expect(html).toContain(COPY.goBack);
    const cancelHtml = renderView({
      tasks: [waiting],
      confirming: { entityId: "w", action: "cancel" },
    });
    expect(cancelHtml).toContain(COPY.cancelConfirm);
    expect(cancelHtml).toContain(COPY.confirmCancel);
  });

  it("does not offer reorder controls in Closed", () => {
    const done = complete(task("c", "Done"), now + 2, []).entity;
    const html = renderView({ tasks: [done] });
    expect(html).toContain(COPY.restore);
    expect(html).not.toContain(COPY.moveUp);
    expect(html).not.toContain(COPY.moveDown);
    expect(html).not.toContain(`>${COPY.complete}<`);
    expect(html).toContain('draggable="false"');
  });
});

describe("system states [D91]", () => {
  it("shows empty motif and starting step", () => {
    const html = renderView();
    expect(html).toContain('data-state="empty"');
    expect(html).toContain("task-board-motif");
    expect(html).toContain(COPY.emptyStep);
    expect(html).toContain('data-column="Waiting"');
  });

  it("shows offline banner with label, icon, and save state", () => {
    const html = renderView({ online: false });
    expect(html).toContain('data-offline="true"');
    expect(html).toContain(COPY.offline);
    expect(html).toContain('data-icon="offline"');
    expect(html).toContain(COPY.saveStateOffline);
  });

  it("offers a skippable completion flourish", () => {
    const html = renderView({ flourish: true });
    expect(html).toContain(COPY.skipFlourish);
    expect(html).toContain("task-complete-flourish");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("task-complete-peak");
  });

  it("shows partial failure on the affected card only", () => {
    const waiting = task("w", "Keep going");
    const other = task("o", "Fine");
    const html = renderView({
      tasks: [waiting, other],
      partialFailures: { w: { cause: "IndexedDB quota exceeded." } },
    });
    expect(html).toContain("IndexedDB quota exceeded.");
    expect(html).toContain(COPY.notChanged);
    expect(html).toContain(COPY.retry);
    expect(html).toContain('data-partial-failure="true"');
    expect(html).toContain('data-entity-id="o"');
    expect(html).toContain('data-column="Waiting"');
  });
});

describe("primary action and copy [D88] [D78]", () => {
  it("uses one filled primary Create task on the board", () => {
    const html = renderView();
    expect((html.match(/data-variant="primary"/g) ?? []).length).toBe(1);
    expect(html).toContain(COPY.createTask);
  });

  it("keeps application copy in English", () => {
    const values = Object.values(COPY).join(" ");
    expect(values).not.toMatch(
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
    );
    expect(COPY.boardTitle).toBe("Task Board");
  });
});

describe("density at 30 cards [D16] [D74] [D87]", () => {
  it("keeps always-on signals on a mixed 30-card board", () => {
    const tasks: Task[] = [];
    for (let index = 0; index < 10; index += 1) {
      tasks.push(
        task(
          `wait-${String(index)}`,
          `Long title ${"đã".repeat(12)} ${String(index)}`,
          {
            description: `desc-${String(index)}`,
          },
        ),
      );
    }
    for (let index = 0; index < 5; index += 1) {
      const base = setBlockIds(
        task(`prog-${String(index)}`, `Progress ${String(index)}`),
        ["b-a", "b-b", "b-c"],
        now,
      );
      tasks.push(moveLiveStatus(base, "In Progress", now + 1, []).entity);
    }
    for (let index = 0; index < 5; index += 1) {
      const base = task(`def-${String(index)}`, `Deferred ${String(index)}`, {
        subtasks: [
          { id: `s-${String(index)}-1`, title: "a", done: true },
          { id: `s-${String(index)}-2`, title: "b", done: false },
        ],
      });
      tasks.push(moveLiveStatus(base, "Deferred", now + 1, []).entity);
    }
    tasks.push(complete(task("c1", "C1"), now + 2, []).entity);
    tasks.push(complete(task("c2", "C2"), now + 3, []).entity);
    tasks.push(complete(task("c3", "C3"), now + 4, []).entity);
    tasks.push(
      abandon(task("a1", "A1"), { confirmed: true }, now + 2, []).entity,
    );
    tasks.push(
      abandon(task("a2", "A2"), { confirmed: true }, now + 3, []).entity,
    );
    tasks.push(
      abandon(task("a3", "A3"), { confirmed: true }, now + 4, []).entity,
    );
    tasks.push(
      cancel(task("x1", "X1"), { confirmed: true }, now + 2, []).entity,
    );
    tasks.push(
      cancel(task("x2", "X2"), { confirmed: true }, now + 3, []).entity,
    );
    const repeating = createTask({
      id: "rep-30",
      title: "Repeat parent",
      now,
      source,
      repeatWeekdays: [6],
    }).task;
    tasks.push(repeating);
    expect(tasks).toHaveLength(29);
    const { occurrence } = createOccurrence({
      id: "occ-30",
      taskId: "rep-30",
      date: workieDayKey(now),
      now,
    });
    const html = renderView({
      tasks,
      occurrences: [occurrence],
      blocks: [
        { id: "b-a", startsAt: now + 60_000 },
        { id: "b-b", startsAt: now + 120_000 },
        { id: "b-c", startsAt: now + 180_000 },
      ],
    });
    expect((html.match(/data-entity-id="/g) ?? []).length).toBe(30);
    expect(html).toContain('data-ornament="dense"');
    expect(html).toContain(COPY.sourceCreator);
    expect(html).toContain(COPY.unscheduled);
    expect(html).toContain("+2 blocks");
    expect(html).toContain("1/2");
    expect(html).toContain(COPY.repeat);
    expect(html).not.toContain("desc-0");
    expect(html).toContain("type-body-m");
  });
});

describe("taskBoard.css tokens", () => {
  it("uses spacing, chamfer, 44px primary, and 2px+2px focus", () => {
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toContain("var(--space-content-");
    expect(css).toContain("var(--space-structure-");
    expect(css).toContain("var(--chamfer-4)");
    expect(css).toContain("var(--target-primary)");
    expect(css).toContain("var(--focus-outline-width)");
    expect(css).toContain("var(--focus-outline-offset)");
  });
});
