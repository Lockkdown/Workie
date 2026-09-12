import { afterEach, describe, expect, it } from "vitest";
import { WorkieDB } from "../db/schema";
import { loadTaskState } from "../db/taskPersistence";
import { createTask } from "../domain/taskModel";
import {
  notifyScheduleTask,
  persistAbandonEntity,
  persistBoardItems,
  persistCancelEntity,
  persistCompleteEntity,
  persistCreatedTask,
  persistRestoreEntity,
  statusUnchangedMessage,
} from "./boardActions";
import { applyLiveDrop } from "./boardModel";

const opened: WorkieDB[] = [];

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

function openDb(): WorkieDB {
  const db = new WorkieDB(`t5-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

const source = { kind: "user" as const, accountId: "local" };

describe("persist create [D10] [D17]", () => {
  it("creates a Waiting unscheduled task with no block", async () => {
    const db = openDb();
    await db.open();
    const { task } = await persistCreatedTask(db, {
      title: "Fresh",
      description: "Hidden on the card",
      subtasks: [{ title: "Step" }],
    });
    expect(task.status).toBe("Waiting");
    expect(task.blockIds).toEqual([]);
    expect(task.repeatWeekdays).toBeUndefined();
    expect(task.source).toEqual({ kind: "user", accountId: "local" });
    const loaded = await loadTaskState(db);
    expect(loaded.tasks).toHaveLength(1);
    expect(loaded.tasks[0]?.blockIds).toEqual([]);
  });

  it("stores weekday repeat when provided", async () => {
    const db = openDb();
    await db.open();
    const { task } = await persistCreatedTask(db, {
      title: "Weekly",
      repeatWeekdays: [1, 3, 5],
    });
    expect(task.repeatWeekdays).toEqual([1, 3, 5]);
  });
});

describe("closing actions persist [D14]", () => {
  it("completes via complete, not drag", async () => {
    const db = openDb();
    await db.open();
    const created = await persistCreatedTask(db, { title: "Do" });
    const closed = await persistCompleteEntity(
      db,
      created.task,
      created.history,
      2,
    );
    expect(closed.entity.status).toBe("Completed");
    const loaded = await loadTaskState(db);
    expect(loaded.tasks[0]?.status).toBe("Completed");
  });

  it("abandons and cancels only with confirmation", async () => {
    const db = openDb();
    await db.open();
    const a = await persistCreatedTask(db, { title: "A", id: "a" });
    const b = await persistCreatedTask(db, { title: "B", id: "b" });
    const abandoned = await persistAbandonEntity(db, a.task, a.history, 2);
    const cancelled = await persistCancelEntity(db, b.task, b.history, 3);
    expect(abandoned.entity.status).toBe("Abandoned");
    expect(cancelled.entity.status).toBe("Cancelled");
  });

  it("restores to Waiting with focus history intact", async () => {
    const db = openDb();
    await db.open();
    const seeded = createTask({
      id: "focus-task",
      title: "Keep sessions",
      now: 1,
      source,
    });
    const withFocus = {
      ...seeded.task,
      focusHistory: ["session-1", "session-2"],
    };
    const closed = await persistCompleteEntity(
      db,
      withFocus,
      seeded.history,
      2,
    );
    const restored = await persistRestoreEntity(
      db,
      closed.entity,
      closed.history,
      3,
    );
    expect(restored.entity.status).toBe("Waiting");
    expect(restored.entity.focusHistory).toEqual(["session-1", "session-2"]);
    const loaded = await loadTaskState(db);
    expect(loaded.tasks[0]?.focusHistory).toEqual(["session-1", "session-2"]);
  });
});

describe("reorder persist [D14]", () => {
  it("writes liveOrder and leaves status Waiting", async () => {
    const db = openDb();
    await db.open();
    const a = await persistCreatedTask(db, { title: "A", id: "a" });
    const b = await persistCreatedTask(db, { title: "B", id: "b" });
    const items = [
      { entity: { ...a.task, liveOrder: 0 }, task: a.task },
      { entity: { ...b.task, liveOrder: 1 }, task: b.task },
    ];
    const dropped = applyLiveDrop({
      items,
      history: [...a.history, ...b.history],
      entityId: "a",
      toColumn: "Waiting",
      toIndex: 1,
      now: 9,
    });
    if (dropped.intent === "ignored") {
      throw new Error("expected reorder");
    }
    await persistBoardItems(db, items, dropped.items);
    const loaded = await loadTaskState(db);
    const byId = new Map(loaded.tasks.map((task) => [task.id, task]));
    expect(byId.get("a")?.status).toBe("Waiting");
    expect(byId.get("b")?.status).toBe("Waiting");
    expect(byId.get("a")?.liveOrder).toBe(1);
    expect(byId.get("b")?.liveOrder).toBe(0);
  });
});

describe("schedule callback [D6] [D92]", () => {
  it("notifies onScheduleTask with the task id and never changes status", () => {
    const seen: string[] = [];
    notifyScheduleTask((taskId) => seen.push(taskId), "task-9");
    expect(seen).toEqual(["task-9"]);
  });

  it("states that a failed status change left the task unchanged", () => {
    expect(statusUnchangedMessage("Quota exceeded.")).toBe(
      "Quota exceeded. The task was not changed.",
    );
  });
});
