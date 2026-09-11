import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { createOccurrence, createTask } from "../domain/taskModel";
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

function userSource() {
  return { kind: "user" as const, accountId: "local" };
}

function recordFor(table: string): object {
  if (table === "tasks") {
    return createTask({
      id: "tasks-1",
      title: "Scaffold",
      now: 1,
      source: userSource(),
    }).task;
  }
  if (table === "occurrences") {
    return createOccurrence({
      id: "occurrences-1",
      taskId: "tasks-1",
      date: "2026-01-01",
      now: 1,
    }).occurrence;
  }
  if (table === "statusHistory") {
    return {
      id: "statusHistory-1",
      entityId: "tasks-1",
      entityKind: "task",
      status: "Waiting",
      workieDay: "2026-01-01",
      at: 1,
      createdAt: 1,
      updatedAt: 1,
    };
  }
  return { id: `${table}-1`, createdAt: 1, updatedAt: 1 };
}

describe("WorkieDB schema", () => {
  it("opens a versioned Dexie schema with all nine domain tables", async () => {
    const db = new WorkieDB(`schema-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    expect(db.verno).toBe(4);
    for (const table of WORKIE_TABLES) {
      expect(db.table(table).name).toBe(table);
      await db.table(table).add(recordFor(table));
      expect(await db.table(table).count()).toBe(1);
    }
    expect(db.settings.name).toBe("settings");
    await db.settings.add({
      id: "theme",
      value: "System",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(await db.settings.count()).toBe(1);
  });

  it("migrates a v1 database into v4 and keeps existing records", async () => {
    const name = `migrate-${crypto.randomUUID()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ tasks: "id" });
    await v1.open();
    await v1.table("tasks").add({ id: "keep", createdAt: 10, updatedAt: 10 });
    v1.close();

    const current = new WorkieDB(name);
    opened.push(current);
    await current.open();
    expect(current.verno).toBe(4);
    expect(await current.tasks.get("keep")).toEqual({
      id: "keep",
      createdAt: 10,
      updatedAt: 10,
    });
    expect(await current.occurrences.count()).toBe(0);
    expect(await current.settings.count()).toBe(0);
    await current.occurrences.add(
      createOccurrence({
        id: "new",
        taskId: "keep",
        date: "2026-01-02",
        now: 2,
      }).occurrence,
    );
    expect(await current.occurrences.count()).toBe(1);
  });

  it("migrates a v2 database into v4 and keeps existing records", async () => {
    const name = `migrate-v2-${crypto.randomUUID()}`;
    const v2 = new Dexie(name);
    v2.version(1).stores({ tasks: "id" });
    v2.version(2).stores({
      tasks: "id, createdAt, updatedAt",
      occurrences: "id, createdAt, updatedAt",
      blocks: "id, createdAt, updatedAt",
      planningDrafts: "id, createdAt, updatedAt",
      statusHistory: "id, createdAt, updatedAt",
      pomodoroCycles: "id, createdAt, updatedAt",
      sessions: "id, createdAt, updatedAt",
      segments: "id, createdAt, updatedAt",
      importReviewDrafts: "id, createdAt, updatedAt",
    });
    await v2.open();
    await v2.table("tasks").add({ id: "keep", createdAt: 10, updatedAt: 10 });
    await v2.table("occurrences").add({
      id: "occ",
      createdAt: 11,
      updatedAt: 11,
    });
    v2.close();

    const current = new WorkieDB(name);
    opened.push(current);
    await current.open();
    expect(current.verno).toBe(4);
    expect(await current.tasks.get("keep")).toEqual({
      id: "keep",
      createdAt: 10,
      updatedAt: 10,
    });
    expect(await current.occurrences.get("occ")).toEqual({
      id: "occ",
      createdAt: 11,
      updatedAt: 11,
    });
    expect(await current.settings.count()).toBe(0);
  });

  it("migrates a v3 database into v4 and keeps existing records", async () => {
    const name = `migrate-v3-${crypto.randomUUID()}`;
    const v3 = new Dexie(name);
    v3.version(1).stores({ tasks: "id" });
    v3.version(2).stores({
      tasks: "id, createdAt, updatedAt",
      occurrences: "id, createdAt, updatedAt",
      blocks: "id, createdAt, updatedAt",
      planningDrafts: "id, createdAt, updatedAt",
      statusHistory: "id, createdAt, updatedAt",
      pomodoroCycles: "id, createdAt, updatedAt",
      sessions: "id, createdAt, updatedAt",
      segments: "id, createdAt, updatedAt",
      importReviewDrafts: "id, createdAt, updatedAt",
    });
    v3.version(3).stores({
      tasks: "id, status, createdAt, updatedAt, *blockIds",
      occurrences:
        "id, taskId, date, [taskId+date], status, createdAt, updatedAt, *blockIds",
      blocks: "id, createdAt, updatedAt",
      planningDrafts: "id, createdAt, updatedAt",
      statusHistory:
        "id, entityId, entityKind, status, workieDay, [entityId+status+workieDay], createdAt, updatedAt",
      pomodoroCycles: "id, createdAt, updatedAt",
      sessions: "id, createdAt, updatedAt",
      segments: "id, createdAt, updatedAt",
      importReviewDrafts: "id, createdAt, updatedAt",
    });
    await v3.open();
    await v3.table("tasks").add({ id: "keep", createdAt: 10, updatedAt: 10 });
    v3.close();

    const current = new WorkieDB(name);
    opened.push(current);
    await current.open();
    expect(current.verno).toBe(4);
    expect(await current.tasks.get("keep")).toEqual({
      id: "keep",
      createdAt: 10,
      updatedAt: 10,
    });
    expect(await current.settings.count()).toBe(0);
    await current.settings.add({
      id: "theme",
      value: "Dark",
      createdAt: 20,
      updatedAt: 20,
    });
    expect(await current.settings.get("theme")).toEqual({
      id: "theme",
      value: "Dark",
      createdAt: 20,
      updatedAt: 20,
    });
  });
});
