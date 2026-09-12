import { afterEach, describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import { WorkieDB } from "../db/schema";
import {
  deleteReviewDraft,
  restoreReviewDraft,
  saveReviewDraft,
} from "./draft";
import { sampleEnvelope } from "./sampleEnvelope";
import { ingestBatchFile } from "./ingest";
import { buildReviewSession, editItemContent } from "./reviewState";
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

function openDb(name = `import-draft-${crypto.randomUUID()}`): WorkieDB {
  const db = new WorkieDB(name);
  opened.push(db);
  return db;
}

describe("import review draft [D101] [D96]", () => {
  it("survives a reload and recomputes duplicates against current tasks", async () => {
    const name = `import-reload-${crypto.randomUUID()}`;
    const first = openDb(name);
    await first.open();
    const session = buildReviewSession(sampleEnvelope(), []);
    const edited = editItemContent(
      session,
      "item-1",
      { title: "Edited in review" },
      [],
    );
    await saveReviewDraft(first, edited, 10);
    expect(await first.tasks.count()).toBe(0);
    first.close();

    const second = openDb(name);
    await second.open();
    await second.tasks.put(
      createTask({
        id: "local",
        title: "Edited in review",
        description: "Produce the locked spec from the source note.",
        now: 11,
        source: { kind: "user", accountId: "local" },
      }).task,
    );
    const restored = await restoreReviewDraft(second);
    expect(restored.ok).toBe(true);
    if (!restored.ok || !restored.session) {
      return;
    }
    expect(restored.session.items[0]?.title).toBe("Edited in review");
    expect(restored.session.items[0]?.duplicate).toBe("Certain duplicate");
    expect(await second.tasks.count()).toBe(1);
    expect(await second.tasks.get("local")).toBeDefined();
  });

  it("does not place draft tasks on Kanban storage", async () => {
    const db = openDb();
    await db.open();
    const file = new File(
      [JSON.stringify(sampleEnvelope())],
      "workie-batch.v1.json",
      { type: "application/json" },
    );
    const ingested = await ingestBatchFile(db, file, 3);
    expect(ingested.ok).toBe(true);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.importReviewDrafts.get(ACTIVE_DRAFT_ID)).toBeDefined();
    await deleteReviewDraft(db);
    expect(await db.importReviewDrafts.count()).toBe(0);
  });
});
