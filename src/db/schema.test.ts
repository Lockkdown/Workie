import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { WorkieDB, WORKIE_TABLES } from "./schema";

const opened: WorkieDB[] = [];

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

describe("WorkieDB schema", () => {
  it("opens a versioned Dexie schema with all nine domain tables", async () => {
    const db = new WorkieDB(`schema-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    expect(db.verno).toBe(2);
    for (const table of WORKIE_TABLES) {
      expect(db.table(table).name).toBe(table);
      await db.table(table).add({
        id: `${table}-1`,
        createdAt: 1,
        updatedAt: 1,
      });
      expect(await db.table(table).count()).toBe(1);
    }
  });

  it("migrates a v1 database into v2 and keeps existing records", async () => {
    const name = `migrate-${crypto.randomUUID()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ tasks: "id" });
    await v1.open();
    await v1.table("tasks").add({ id: "keep", createdAt: 10, updatedAt: 10 });
    v1.close();

    const v2 = new WorkieDB(name);
    opened.push(v2);
    await v2.open();
    expect(v2.verno).toBe(2);
    expect(await v2.tasks.get("keep")).toEqual({
      id: "keep",
      createdAt: 10,
      updatedAt: 10,
    });
    expect(await v2.occurrences.count()).toBe(0);
    await v2.occurrences.add({ id: "new", createdAt: 2, updatedAt: 2 });
    expect(await v2.occurrences.count()).toBe(1);
  });
});
