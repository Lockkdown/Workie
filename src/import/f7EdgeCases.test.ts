import { afterEach, describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import { WorkieDB } from "../db/schema";
import { commitImportBatch, prepareImportBatch } from "./commit";
import { COPY } from "./copy";
import { sampleEnvelope } from "./sampleEnvelope";
import { ingestBatchFile } from "./ingest";
import {
  addAnyway,
  buildReviewSession,
  editItemContent,
  validateSelected,
} from "./reviewState";
import type { BatchEnvelope } from "./types";

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
  const db = new WorkieDB(`f7-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

function twelve(): BatchEnvelope {
  return sampleEnvelope({
    tasks: Array.from({ length: 12 }, (_, index) => ({
      itemKey: `item-${String(index + 1)}`,
      order: index,
      title: `Outcome ${String(index + 1)}`,
      description: `Independent outcome ${String(index + 1)} from the source.`,
      subtasks: [],
    })),
  });
}

describe("F7 edge cases", () => {
  it("resend after a lost success is Certain duplicate and unselected [D15] [D63]", async () => {
    const db = openDb();
    await db.open();
    const firstFile = new File(
      [JSON.stringify(sampleEnvelope())],
      "workie-batch.v1.json",
      { type: "application/json" },
    );
    const first = await ingestBatchFile(db, firstFile, 1);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const prepared = prepareImportBatch(first.session, {
      now: 2,
      newId: () => "imported",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    await commitImportBatch(db, prepared.prepared);
    const resend = await ingestBatchFile(db, firstFile, 3);
    expect(resend.ok).toBe(true);
    if (!resend.ok) {
      return;
    }
    const item = resend.session.items[0];
    expect(item?.duplicate).toBe("Certain duplicate");
    expect(item?.selected).toBe(false);
  });

  it("Add anyway creates a second task and does not merge [D15]", async () => {
    const db = openDb();
    await db.open();
    await db.tasks.put(
      createTask({
        id: "first",
        title: "Write the spec",
        description: "Produce the locked spec from the source note.",
        now: 1,
        source: {
          kind: "ai",
          sourceName: "Vault roadmap",
          sourceMark: "vault:roadmap",
          itemKey: "item-1",
        },
      }).task,
    );
    const session = addAnyway(
      buildReviewSession(sampleEnvelope(), await db.tasks.toArray()),
      "item-1",
    );
    const item = session.items[0];
    expect(item?.duplicate).toBe("Certain duplicate");
    expect(item?.selected).toBe(true);
    const prepared = prepareImportBatch(session, {
      now: 4,
      newId: () => "second",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    await commitImportBatch(db, prepared.prepared);
    expect(await db.tasks.count()).toBe(2);
    expect(await db.tasks.get("first")).toBeDefined();
    expect(await db.tasks.get("second")).toBeDefined();
  });

  it("Possible duplicate stays selected with a comparison and does not block commit [D15]", async () => {
    const db = openDb();
    await db.open();
    const local = createTask({
      id: "near",
      title: "Write the spec later",
      description: "Different body.",
      now: 1,
      source: { kind: "user", accountId: "local" },
    }).task;
    await db.tasks.put(local);
    const locals = await db.tasks.toArray();
    const session = buildReviewSession(sampleEnvelope(), locals);
    const item = session.items[0];
    expect(item?.duplicate).toBe("Possible duplicate");
    expect(item?.selected).toBe(true);
    expect(item?.matchedTaskId).toBe("near");
    expect(session.compareKeys).toContain("item-1");
    const prepared = prepareImportBatch(session, {
      now: 5,
      newId: () => "imported",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    await commitImportBatch(db, prepared.prepared);
    expect(await db.tasks.count()).toBe(2);
    expect(await db.tasks.get("near")).toEqual(local);
  });

  it("editing a title to match an existing task recomputes content detection and preserves source-mark [D62]", () => {
    const local = createTask({
      id: "user-1",
      title: "Shared title",
      description: "User body.",
      now: 1,
      source: { kind: "user", accountId: "local" },
    }).task;
    const session = buildReviewSession(sampleEnvelope(), [local]);
    expect(session.items[0]?.duplicate).toBe("new");
    const edited = editItemContent(
      session,
      "item-1",
      { title: "Shared title" },
      [local],
    );
    expect(edited.items[0]?.duplicate).toBe("Possible duplicate");
    expect(edited.items[0]?.sourceMarkCertain).toBe(false);
    const markLocal = createTask({
      id: "ai-1",
      title: "Old",
      description: "Old",
      now: 1,
      source: {
        kind: "ai",
        sourceName: "Vault roadmap",
        sourceMark: "vault:roadmap",
        itemKey: "item-1",
      },
    }).task;
    const marked = buildReviewSession(sampleEnvelope(), [markLocal]);
    const afterEdit = editItemContent(
      marked,
      "item-1",
      { title: "Shared title", description: "User body." },
      [markLocal, local],
    );
    expect(afterEdit.items[0]?.sourceMarkCertain).toBe(true);
    expect(afterEdit.items[0]?.duplicate).toBe("Certain duplicate");
  });

  it("changed source content shows a difference and does not modify the local copy [D15]", async () => {
    const db = openDb();
    await db.open();
    const local = createTask({
      id: "keep",
      title: "Write the spec",
      description: "Original local copy.",
      now: 1,
      source: {
        kind: "ai",
        sourceName: "Vault roadmap",
        sourceMark: "vault:roadmap",
        itemKey: "item-1",
      },
    }).task;
    await db.tasks.put(local);
    const session = buildReviewSession(
      sampleEnvelope(),
      await db.tasks.toArray(),
    );
    const item = session.items[0];
    expect(item?.duplicate).toBe("Certain duplicate");
    expect(item?.contentChanged).toBe(true);
    expect(item?.localDescription).toBe("Original local copy.");
    expect(item?.description).toBe(
      "Produce the locked spec from the source note.",
    );
    expect(await db.tasks.get("keep")).toEqual(local);
  });

  it("an unclear source keeps one nearest boundary and states uncertainty in the review [D60]", () => {
    const envelope = sampleEnvelope({
      tasks: [
        {
          itemKey: "vague",
          order: 0,
          title: "Nearest source boundary",
          description:
            "Unclear source; keeping the nearest boundary rather than inventing a split.",
          subtasks: [],
        },
      ],
    });
    const session = buildReviewSession(envelope, []);
    expect(session.items).toHaveLength(1);
    expect(session.items[0]?.description).toMatch(/nearest boundary/);
    expect(session.items[0]?.subtasks).toEqual([]);
  });

  it("a source with no natural steps keeps an empty subtask list [D59]", () => {
    const session = buildReviewSession(sampleEnvelope(), []);
    expect(session.items[0]?.subtasks).toEqual([]);
    const prepared = prepareImportBatch(session, {
      now: 1,
      newId: () => "empty-subs",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    expect(prepared.prepared.graph.tasks?.[0]?.subtasks).toEqual([]);
  });

  it("one invalid task in a batch of twelve creates nothing, names that task, and keeps the other eleven edits [D63]", () => {
    const session = buildReviewSession(twelve(), []);
    expect(session.items).toHaveLength(12);
    const edited = session.items.reduce((current, item, index) => {
      const title = index === 6 ? "  " : `${item.title} edited`;
      return editItemContent(current, item.itemKey, { title }, []);
    }, session);
    const invalid = edited.items[6];
    expect(invalid?.title).toBe("  ");
    expect(
      edited.items.filter((item) => item.title.endsWith("edited")),
    ).toHaveLength(11);
    const valid = validateSelected(edited);
    expect(valid.ok).toBe(false);
    if (!valid.ok) {
      expect(valid.itemKey).toBe("item-7");
      expect(valid.error).toMatch(/item-7/);
    }
    const prepared = prepareImportBatch(edited, {
      now: 8,
      newId: () => crypto.randomUUID(),
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.itemKey).toBe("item-7");
    }
  });
});

describe("F7 review copy", () => {
  it("exposes the canonical duplicate strings", () => {
    expect(COPY.certainDuplicate).toBe("Certain duplicate");
    expect(COPY.possibleDuplicate).toBe("Possible duplicate");
    expect(COPY.addAnyway).toBe("Add anyway");
    expect(COPY.compare).toBe("Compare");
  });
});
