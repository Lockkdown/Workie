import { afterEach, describe, expect, it } from "vitest";
import { createOccurrence, createTask } from "../domain/taskModel";
import { commitAtomic } from "./atomicCommit";
import { WorkieDB } from "./schema";

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

describe("commitAtomic", () => {
  it("writes several records in one readwrite transaction", async () => {
    const db = new WorkieDB(`commit-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    const { task } = createTask({
      id: "t1",
      title: "One",
      now: 1,
      source,
    });
    await commitAtomic(db, async () => {
      await db.tasks.add(task);
      await db.blocks.add({ id: "b1", createdAt: 1, updatedAt: 1 });
    });
    expect(await db.tasks.count()).toBe(1);
    expect(await db.blocks.count()).toBe(1);
  });

  it("aborts and leaves zero records when work throws", async () => {
    const db = new WorkieDB(`abort-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    const { task } = createTask({
      id: "t1",
      title: "One",
      now: 1,
      source,
    });
    const { occurrence } = createOccurrence({
      id: "o1",
      taskId: "t1",
      date: "2026-01-01",
      now: 1,
    });
    await expect(
      commitAtomic(db, async () => {
        await db.tasks.add(task);
        await db.occurrences.add(occurrence);
        throw new Error("forced-error");
      }),
    ).rejects.toThrow("forced-error");
    expect(await db.tasks.count()).toBe(0);
    expect(await db.occurrences.count()).toBe(0);
    expect(await db.blocks.count()).toBe(0);
  });
});
