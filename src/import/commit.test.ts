import { afterEach, describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import { WorkieDB } from "../db/schema";
import { commitImportBatch, prepareImportBatch } from "./commit";
import { saveReviewDraft } from "./draft";
import { sampleEnvelope } from "./sampleEnvelope";
import { ingestBatchFile } from "./ingest";
import { buildReviewSession } from "./reviewState";
import { ACTIVE_DRAFT_ID } from "./types";

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
  const db = new WorkieDB(`import-commit-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

describe("import commit [D63] [D96]", () => {
  it("writes selected tasks in one transaction and deletes the draft", async () => {
    const db = openDb();
    await db.open();
    const session = buildReviewSession(sampleEnvelope(), []);
    await saveReviewDraft(db, session, 10);
    const prepared = prepareImportBatch(session, {
      now: 20,
      newId: () => "task-import-1",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    await commitImportBatch(db, prepared.prepared);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.importReviewDrafts.count()).toBe(0);
    const task = await db.tasks.get("task-import-1");
    expect(task?.source.kind).toBe("ai");
    expect(task?.status).toBe("Waiting");
    expect(task?.blockIds).toEqual([]);
    expect(task?.repeatWeekdays).toBeUndefined();
    expect(task?.liveOrder).toBe(0);
  });

  it("aborts a forced throw inside the transaction and leaves zero local tasks", async () => {
    const db = openDb();
    await db.open();
    const session = buildReviewSession(sampleEnvelope(), []);
    await saveReviewDraft(db, session, 10);
    expect(await db.importReviewDrafts.get(ACTIVE_DRAFT_ID)).toBeDefined();
    const prepared = prepareImportBatch(session, {
      now: 20,
      newId: () => "task-import-1",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    await expect(
      commitImportBatch(db, prepared.prepared, { throwAfter: 1 }),
    ).rejects.toThrow("forced-import-error");
    expect(await db.tasks.count()).toBe(0);
    expect(await db.occurrences.count()).toBe(0);
    expect(await db.statusHistory.count()).toBe(0);
    expect(await db.importReviewDrafts.count()).toBe(1);
  });

  it("does not merge or update an existing local task on Add anyway", async () => {
    const db = openDb();
    await db.open();
    const existing = createTask({
      id: "keep",
      title: "Write the spec",
      description: "Produce the locked spec from the source note.",
      now: 1,
      source: {
        kind: "ai",
        sourceName: "Vault roadmap",
        sourceMark: "vault:roadmap",
        itemKey: "item-1",
      },
    });
    await db.tasks.put(existing.task);
    const file = new File(
      [JSON.stringify(sampleEnvelope())],
      "workie-batch.v1.json",
      { type: "application/json" },
    );
    const ingested = await ingestBatchFile(db, file, 5);
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) {
      return;
    }
    const selected = {
      ...ingested.session,
      items: ingested.session.items.map((item) => ({
        ...item,
        selected: true,
      })),
    };
    const prepared = prepareImportBatch(selected, {
      now: 20,
      newId: () => "second",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    await commitImportBatch(db, prepared.prepared);
    expect(await db.tasks.count()).toBe(2);
    expect(await db.tasks.get("keep")).toEqual(existing.task);
    const second = await db.tasks.get("second");
    expect(second?.source).toEqual({
      kind: "ai",
      sourceName: "Vault roadmap",
      sourceMark: "vault:roadmap",
      itemKey: "item-1",
    });
  });
});
