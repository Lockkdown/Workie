import { afterEach, describe, expect, it } from "vitest";
import { complete, restore } from "../domain/transitions";
import { createTask } from "../domain/taskModel";
import { commitAtomic } from "./atomicCommit";
import { WorkieDB } from "./schema";
import {
  loadTaskState,
  persistBackfillMissedOccurrences,
  persistEnsureTomorrowOccurrences,
  persistNewTask,
  persistStatusChange,
} from "./taskPersistence";

const opened: WorkieDB[] = [];

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

const source = { kind: "user" as const, accountId: "local" };

function openDb(): WorkieDB {
  const db = new WorkieDB(`persist-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

describe("task persistence", () => {
  it("survives a simulated reload", async () => {
    const name = `reload-${crypto.randomUUID()}`;
    const first = new WorkieDB(name);
    opened.push(first);
    await first.open();
    const { task } = await persistNewTask(first, {
      title: "Keep me",
      source,
      now: 1_000,
      id: "task-keep",
    });
    first.close();

    const second = new WorkieDB(name);
    opened.push(second);
    await second.open();
    const loaded = await loadTaskState(second);
    expect(loaded.tasks).toEqual([task]);
    expect(loaded.statusHistory).toHaveLength(1);
    expect(loaded.statusHistory[0]?.status).toBe("Waiting");
  });

  it("rolls back a fresh atomic graph write to zero records", async () => {
    const db = openDb();
    await db.open();
    const a = createTask({ id: "a", title: "A", now: 1, source });
    const b = createTask({ id: "b", title: "B", now: 1, source });
    const waiting = a.history[0];
    expect(waiting).toBeDefined();
    await expect(
      commitAtomic(db, async () => {
        await db.tasks.add(a.task);
        await db.tasks.add(b.task);
        if (waiting) {
          await db.statusHistory.add(waiting);
        }
        throw new Error("forced-error");
      }),
    ).rejects.toThrow("forced-error");
    expect(await db.tasks.count()).toBe(0);
    expect(await db.statusHistory.count()).toBe(0);
  });

  it("does not rewrite status-history events on restore persist", async () => {
    const db = openDb();
    await db.open();
    const seeded = await persistNewTask(db, {
      id: "t1",
      title: "Close me",
      source,
      now: 1,
    });
    const closed = complete(seeded.task, 2, seeded.history);
    await persistStatusChange(db, closed.entity, closed.history);
    const before = await db.statusHistory.toArray();
    const restored = restore(closed.entity, 3, closed.history);
    await persistStatusChange(db, restored.entity, restored.history);
    const after = await db.statusHistory.toArray();
    for (const event of before) {
      expect(after.find((item) => item.id === event.id)).toEqual(event);
    }
  });

  it("creates tomorrow occurrences once through persistence", async () => {
    const db = openDb();
    await db.open();
    const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    await persistNewTask(db, {
      id: "rep",
      title: "Daily",
      source,
      now,
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const first = await persistEnsureTomorrowOccurrences(db, now);
    const second = await persistEnsureTomorrowOccurrences(db, now);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(await db.occurrences.count()).toBe(1);
  });

  it("back-fills missed occurrences without duplicates", async () => {
    const db = openDb();
    await db.open();
    const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    const lastOpen = new Date(2026, 5, 12, 12, 0, 0, 0).getTime();
    await persistNewTask(db, {
      id: "rep",
      title: "Daily",
      source,
      now: lastOpen,
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const first = await persistBackfillMissedOccurrences(db, now, lastOpen);
    const second = await persistBackfillMissedOccurrences(db, now, lastOpen);
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(0);
    expect(await db.occurrences.count()).toBe(3);
  });
});
