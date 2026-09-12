import { afterEach, describe, expect, it } from "vitest";
import { WorkieDB } from "../db/schema";
import { prepareContext, recoverRunningOnLoad, startCycle } from "./engine";
import { loadCycles, loadDefaultBudgetMs, persistCycle } from "./persist";
import { DEFAULT_BUDGET_MS } from "./types";

const opened: WorkieDB[] = [];

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

describe("pomodoro persist", () => {
  it("reloads a cycle and treats a still-running row as awaiting reconciliation", async () => {
    const name = `pomo-${crypto.randomUUID()}`;
    const first = new WorkieDB(name);
    opened.push(first);
    await first.open();
    const started = startCycle(
      [],
      prepareContext({ taskId: "t1", blockId: null }),
      1_000,
      { cycleId: "c1", sessionId: "s1", segmentId: "g1" },
    );
    if (!started.ok) {
      throw new Error("start");
    }
    await persistCycle(first, started.cycle);
    first.close();

    const second = new WorkieDB(name);
    opened.push(second);
    await second.open();
    const loaded = await loadCycles(second);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.budgetMs).toBe(DEFAULT_BUDGET_MS);
    const recovered = recoverRunningOnLoad(loaded[0]!, 5_000);
    expect(recovered.state).toBe("awaiting reconciliation");
    expect(await loadDefaultBudgetMs(second)).toBe(DEFAULT_BUDGET_MS);
  });
});
