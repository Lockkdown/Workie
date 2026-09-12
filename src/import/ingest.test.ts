import { afterEach, describe, expect, it } from "vitest";
import { WorkieDB } from "../db/schema";
import { sampleEnvelope } from "./sampleEnvelope";
import { ingestBatchFile, readBatchText } from "./ingest";

const opened: WorkieDB[] = [];

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

describe("ingest [D97]", () => {
  it("reading a valid file does not create tasks", async () => {
    const db = new WorkieDB(`ingest-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    const text = JSON.stringify(sampleEnvelope());
    const parsed = readBatchText(text, "workie-batch.v1.json");
    expect(parsed.ok).toBe(true);
    expect(await db.tasks.count()).toBe(0);
    const file = new File([text], "workie-batch.v1.json", {
      type: "application/json",
    });
    const ingested = await ingestBatchFile(db, file, 4);
    expect(ingested.ok).toBe(true);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.occurrences.count()).toBe(0);
    expect(await db.statusHistory.count()).toBe(0);
  });

  it("does not write a draft when validation fails", async () => {
    const db = new WorkieDB(`ingest-bad-${crypto.randomUUID()}`);
    opened.push(db);
    await db.open();
    const file = new File(
      [JSON.stringify({ ...sampleEnvelope(), extra: true })],
      "workie-batch.v1.json",
      { type: "application/json" },
    );
    const ingested = await ingestBatchFile(db, file, 4);
    expect(ingested.ok).toBe(false);
    expect(await db.importReviewDrafts.count()).toBe(0);
    expect(await db.tasks.count()).toBe(0);
  });
});
