import { afterEach, describe, expect, it } from "vitest";
import { WorkieDB } from "../db/schema";
import { tomorrowWorkieDay } from "../domain/workieDay";
import { emptyDocument, toggleSelected } from "./ritual";
import { loadPlanningDocument, savePlanningDocument } from "./persist";

const opened: WorkieDB[] = [];
const NOW = new Date(2026, 8, 14, 20, 0, 0, 0).getTime();

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

describe("planning draft persist [D23]", () => {
  it("reload restores an uncommitted draft", async () => {
    const name = `plan-${crypto.randomUUID()}`;
    const day = tomorrowWorkieDay(NOW);
    const first = new WorkieDB(name);
    opened.push(first);
    await first.open();
    const doc = toggleSelected(emptyDocument(day, NOW), "task-1", NOW);
    await savePlanningDocument(first, doc);
    first.close();

    const second = new WorkieDB(name);
    opened.push(second);
    await second.open();
    const loaded = await loadPlanningDocument(second, day);
    expect(loaded?.commitState).toBe("draft");
    expect(loaded?.selectedIds).toEqual(["task-1"]);
  });
});
