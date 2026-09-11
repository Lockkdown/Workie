import { afterEach, describe, expect, it } from "vitest";
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

describe("commitAtomic", () => {
  it("writes several records in one readwrite transaction", async () => {
    const db = new WorkieDB(`commit-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    await commitAtomic(db, async () => {
      await db.tasks.add({ id: "t1", createdAt: 1, updatedAt: 1 });
      await db.blocks.add({ id: "b1", createdAt: 1, updatedAt: 1 });
    });
    expect(await db.tasks.count()).toBe(1);
    expect(await db.blocks.count()).toBe(1);
  });

  it("aborts and leaves zero records when work throws", async () => {
    const db = new WorkieDB(`abort-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    await expect(
      commitAtomic(db, async () => {
        await db.tasks.add({ id: "t1", createdAt: 1, updatedAt: 1 });
        await db.occurrences.add({ id: "o1", createdAt: 1, updatedAt: 1 });
        throw new Error("forced-error");
      }),
    ).rejects.toThrow("forced-error");
    expect(await db.tasks.count()).toBe(0);
    expect(await db.occurrences.count()).toBe(0);
    expect(await db.blocks.count()).toBe(0);
  });
});
