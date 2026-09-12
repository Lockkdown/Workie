import { describe, expect, it } from "vitest";
import { createOccurrence, createTask, setBlockIds } from "../domain/taskModel";
import {
  abandon,
  cancel,
  complete,
  moveLiveStatus,
} from "../domain/transitions";
import { workieDayKey } from "../domain/workieDay";
import {
  applyLiveDrop,
  applyMoveRelative,
  applyMoveToLive,
  dropIntent,
  formatNearestBlock,
  groupBoard,
  scheduleTaskId,
  selectBoardItems,
  signalsFor,
  sortClosed,
  sortLive,
  sourceLabel,
} from "./boardModel";

const source = { kind: "user" as const, accountId: "local" };
const now = new Date(2026, 8, 12, 12, 0, 0, 0).getTime();

function seed(id: string, title = id) {
  return createTask({ id, title, now, source });
}

describe("board grouping [D11]", () => {
  it("maps six statuses onto four columns with Closed subgroups", () => {
    const waiting = seed("w");
    const progress = moveLiveStatus(
      seed("p").task,
      "In Progress",
      now + 1,
      seed("p").history,
    );
    const deferred = moveLiveStatus(
      seed("d").task,
      "Deferred",
      now + 1,
      seed("d").history,
    );
    const done = complete(seed("c").task, now + 1, seed("c").history);
    const abandoned = abandon(
      seed("a").task,
      { confirmed: true },
      now + 1,
      seed("a").history,
    );
    const cancelled = cancel(
      seed("x").task,
      { confirmed: true },
      now + 1,
      seed("x").history,
    );
    const items = [
      { entity: waiting.task, task: waiting.task },
      { entity: progress.entity, task: progress.entity },
      { entity: deferred.entity, task: deferred.entity },
      { entity: done.entity, task: done.entity },
      { entity: abandoned.entity, task: abandoned.entity },
      { entity: cancelled.entity, task: cancelled.entity },
    ];
    const columns = groupBoard(items, [
      ...waiting.history,
      ...progress.history,
      ...deferred.history,
      ...done.history,
      ...abandoned.history,
      ...cancelled.history,
    ]);
    expect(columns.Waiting.map((item) => item.entity.id)).toEqual(["w"]);
    expect(columns["In Progress"].map((item) => item.entity.id)).toEqual(["p"]);
    expect(columns.Deferred.map((item) => item.entity.id)).toEqual(["d"]);
    expect(columns.Closed.map((group) => group.status)).toEqual([
      "Completed",
      "Abandoned",
      "Cancelled",
    ]);
    expect(columns.Closed[0]?.items.map((item) => item.entity.id)).toEqual([
      "c",
    ]);
    expect(columns.Closed[1]?.items.map((item) => item.entity.id)).toEqual([
      "a",
    ]);
    expect(columns.Closed[2]?.items.map((item) => item.entity.id)).toEqual([
      "x",
    ]);
  });

  it("shows tasks and today's occurrences, using the parent title", () => {
    const { task } = createTask({
      id: "rep",
      title: "Parent title",
      now,
      source,
      repeatWeekdays: [6],
    });
    const { occurrence } = createOccurrence({
      id: "occ-today",
      taskId: "rep",
      date: workieDayKey(now),
      now,
    });
    const { occurrence: otherDay } = createOccurrence({
      id: "occ-other",
      taskId: "rep",
      date: "2026-09-11",
      now,
    });
    const items = selectBoardItems([task], [occurrence, otherDay], now);
    expect(items).toHaveLength(2);
    const occ = items.find((item) => item.entity.id === "occ-today");
    expect(occ?.task.title).toBe("Parent title");
    expect(occ ? scheduleTaskId(occ) : undefined).toBe("rep");
    expect(items.some((item) => item.entity.id === "occ-other")).toBe(false);
  });
});

describe("drop and reorder [D14]", () => {
  it("reorders inside a live column without changing status", () => {
    const a = seed("a").task;
    const b = seed("b").task;
    const c = seed("c").task;
    const items = [
      { entity: { ...a, liveOrder: 0 }, task: a },
      { entity: { ...b, liveOrder: 1 }, task: b },
      { entity: { ...c, liveOrder: 2 }, task: c },
    ];
    const result = applyLiveDrop({
      items,
      history: [],
      entityId: "a",
      toColumn: "Waiting",
      toIndex: 2,
      now: now + 5,
    });
    expect(result.intent).toBe("reorder");
    if (result.intent === "ignored") {
      throw new Error("expected reorder");
    }
    expect(sortLive(result.items).map((item) => item.entity.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(result.items.every((item) => item.entity.status === "Waiting")).toBe(
      true,
    );
  });

  it("changes status when dropping between live columns", () => {
    const seeded = seed("a");
    const result = applyLiveDrop({
      items: [{ entity: seeded.task, task: seeded.task }],
      history: seeded.history,
      entityId: "a",
      toColumn: "In Progress",
      toIndex: 0,
      now: now + 5,
    });
    expect(result.intent).toBe("move-live");
    if (result.intent === "ignored") {
      throw new Error("expected move");
    }
    expect(result.items[0]?.entity.status).toBe("In Progress");
  });

  it("never completes, abandons, or cancels from a drop onto Closed", () => {
    const seeded = seed("a");
    expect(dropIntent("Waiting", "Closed")).toBe("ignored");
    expect(dropIntent("Completed", "Waiting")).toBe("ignored");
    const relative = applyMoveRelative({
      items: [
        {
          entity: complete(seeded.task, now + 1, seeded.history).entity,
          task: seeded.task,
        },
      ],
      entityId: "a",
      direction: 1,
      now: now + 2,
    });
    expect(relative).toBeUndefined();
  });

  it("moves with labelled equivalents and ignores a no-op", () => {
    const seeded = seed("a");
    const moved = applyMoveToLive({
      items: [{ entity: seeded.task, task: seeded.task }],
      history: seeded.history,
      entityId: "a",
      to: "Deferred",
      now: now + 3,
    });
    expect("intent" in moved).toBe(false);
    if ("intent" in moved) {
      throw new Error("expected move");
    }
    expect(moved.items[0]?.entity.status).toBe("Deferred");
    const same = applyMoveToLive({
      items: [{ entity: seeded.task, task: seeded.task }],
      history: seeded.history,
      entityId: "a",
      to: "Waiting",
      now: now + 4,
    });
    expect(same).toEqual({ intent: "ignored" });
  });

  it("Move up / down swaps liveOrder only", () => {
    const a = { ...seed("a").task, liveOrder: 0 };
    const b = { ...seed("b").task, liveOrder: 1 };
    const items = [
      { entity: a, task: a },
      { entity: b, task: b },
    ];
    const down = applyMoveRelative({
      items,
      entityId: "a",
      direction: 1,
      now: now + 1,
    });
    expect(
      down ? sortLive(down).map((item) => item.entity.id) : undefined,
    ).toEqual(["b", "a"]);
    expect(down?.every((item) => item.entity.status === "Waiting")).toBe(true);
  });
});

describe("closed sort [D14]", () => {
  it("orders by most recent closing time, else updatedAt", () => {
    const older = complete(seed("older").task, now + 10, seed("older").history);
    const newer = abandon(
      seed("newer").task,
      { confirmed: true },
      now + 50,
      seed("newer").history,
    );
    const sorted = sortClosed(
      [
        { entity: older.entity, task: older.entity },
        { entity: newer.entity, task: newer.entity },
      ],
      [...older.history, ...newer.history],
    );
    expect(sorted.map((item) => item.entity.id)).toEqual(["newer", "older"]);
  });
});

describe("card signals on the board [D8] [D16]", () => {
  it("projects title, status, source, Unscheduled, +N, subtasks, and Repeat", () => {
    const created = createTask({
      id: "t1",
      title: "Việc cần làm",
      now,
      source,
      repeatWeekdays: [6],
      subtasks: [
        { id: "s1", title: "one", done: true },
        { id: "s2", title: "two", done: false },
      ],
    });
    const planned = setBlockIds(created.task, ["b1", "b2"], now);
    const { occurrence } = createOccurrence({
      id: "o1",
      taskId: "t1",
      date: workieDayKey(now),
      now,
    });
    const item = { entity: occurrence, task: planned };
    const signals = signalsFor(
      item,
      [
        { id: "b1", startsAt: now + 60_000 },
        { id: "b2", startsAt: now + 120_000 },
      ],
      now,
      created.history,
    );
    expect(signals.title).toBe("Việc cần làm");
    expect(signals.status).toBe("Waiting");
    expect(sourceLabel(signals.source)).toBe("local");
    expect(signals.extraBlocksCaption).toBeUndefined();
    expect(formatNearestBlock("Unscheduled")).toBe("Unscheduled");
    const taskItem = { entity: planned, task: planned };
    const taskSignals = signalsFor(
      taskItem,
      [
        { id: "b1", startsAt: now + 60_000 },
        { id: "b2", startsAt: now + 120_000 },
      ],
      now,
      created.history,
    );
    expect(taskSignals.extraBlocksCaption).toBe("+1 blocks");
    expect(taskSignals.subtaskProgress).toEqual({ done: 1, total: 2 });
    expect(taskSignals.repeat).toEqual({
      mark: true,
      occurrenceDate: undefined,
    });
    expect(signals.repeat).toEqual({
      mark: true,
      occurrenceDate: workieDayKey(now),
    });
  });
});
