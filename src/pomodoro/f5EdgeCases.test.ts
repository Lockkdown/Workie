import { describe, expect, it } from "vitest";
import {
  beginSwitch,
  confirmedFocusMs,
  discardCycle,
  isCountedCompletedPomodoro,
  loseObservation,
  pauseCycle,
  prepareContext,
  reconcile,
  remainingBudgetMs,
  resumeOnTask,
  sessionsOverlap,
  shouldPushCalendar,
  skipBreak,
  startBreak,
  startCycle,
  tickRunning,
} from "./engine";
import { DEFAULT_BUDGET_MS } from "./types";
import type { EngineIds, PomodoroCycle } from "./types";

const T0 = new Date(2026, 8, 14, 10, 0, 0, 0).getTime();

function ids(n: number): EngineIds {
  return { cycleId: `c${n}`, sessionId: `s${n}`, segmentId: `g${n}` };
}

function started(budget = DEFAULT_BUDGET_MS): PomodoroCycle {
  const result = startCycle(
    [],
    prepareContext({ taskId: "A", blockId: "bA", defaultBudgetMs: budget }),
    T0,
    ids(1),
  );
  if (!result.ok) {
    throw new Error("start");
  }
  return result.cycle;
}

describe("F5 edge cases", () => {
  it("completing task A at minute 15 then switching to B stays one Pomodoro", () => {
    const switching = beginSwitch(started(), T0 + 15 * 60_000);
    const resumed = resumeOnTask(switching, {
      taskId: "B",
      blockId: "bB",
      now: T0 + 16 * 60_000,
      ids: { sessionId: "sB", segmentId: "gB" },
    });
    const done = tickRunning(resumed, T0 + 31 * 60_000);
    expect(done.outcome).toBe("Timer complete");
    expect(done.sessions).toHaveLength(2);
    expect(confirmedFocusMs(done, T0 + 40 * 60_000)).toBe(DEFAULT_BUDGET_MS);
    expect(done.sessions[0]?.taskId).toBe("A");
    expect(
      confirmedFocusMs(
        { ...done, sessions: [done.sessions[0]!], state: "ended" },
        T0,
      ),
    ).toBe(15 * 60_000);
    expect(sessionsOverlap(done)).toBe(false);
  });

  it("requesting a new Pomodoro while awaiting reconciliation returns that cycle", () => {
    const lost = loseObservation(started(), T0 + 1_000);
    const again = startCycle(
      [lost],
      prepareContext({ taskId: "other" }),
      T0 + 2_000,
      ids(2),
    );
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.cycle.id).toBe(lost.id);
      expect(again.cycle.state).toBe("awaiting reconciliation");
    }
  });

  it("reconciliation across 00:00 creates no extra block or session", () => {
    const late = new Date(2026, 8, 14, 23, 55, 0, 0).getTime();
    const after = new Date(2026, 8, 15, 0, 20, 0, 0).getTime();
    const result = startCycle(
      [],
      prepareContext({ taskId: "A", blockId: "bA" }),
      late,
      ids(1),
    );
    if (!result.ok) {
      throw new Error("start");
    }
    const next = reconcile(
      loseObservation(result.cycle, late + 60_000),
      "focus",
      after,
      "gap",
    ).cycle;
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]?.blockId).toBe("bA");
  });

  it("an unscheduled long run does not push the calendar", () => {
    const result = startCycle(
      [],
      prepareContext({ taskId: "A", blockId: null }),
      T0,
      ids(1),
    );
    if (!result.ok) {
      throw new Error("start");
    }
    expect(
      shouldPushCalendar({
        session: result.cycle.sessions[0]!,
        blockEndMs: T0 + 60_000,
        now: T0 + 20 * 60_000,
      }),
    ).toBe(false);
  });

  it("the referenced block ending leaves the cycle running", () => {
    expect(tickRunning(started(), T0 + 1_000).state).toBe("running");
  });

  it("changing the duration setting does not change a paused budget", () => {
    const paused = pauseCycle(started(), T0 + 1_000);
    expect(paused.budgetMs).toBe(DEFAULT_BUDGET_MS);
    const blocked = startCycle(
      [paused],
      prepareContext({ taskId: "B", defaultBudgetMs: 99 * 60_000 }),
      T0 + 2_000,
      ids(2),
    );
    expect(blocked.ok).toBe(false);
  });

  it("skipping the break and starting a new cycle snapshots the current default", () => {
    const first = tickRunning(started(60_000), T0 + 60_000);
    skipBreak();
    const second = startCycle(
      [first],
      prepareContext({ taskId: "B", defaultBudgetMs: 12 * 60_000 }),
      T0 + 90_000,
      ids(2),
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.cycle.budgetMs).toBe(12 * 60_000);
    }
  });

  it("work between two cycles is not recorded", () => {
    const first = tickRunning(started(60_000), T0 + 60_000);
    const secondStart = T0 + 10 * 60_000;
    const second = startCycle(
      [first],
      prepareContext({ taskId: "B" }),
      secondStart,
      ids(2),
    );
    if (!second.ok) {
      throw new Error("start");
    }
    expect(confirmedFocusMs(second.cycle, secondStart)).toBe(0);
    expect(remainingBudgetMs(second.cycle, secondStart)).toBe(
      DEFAULT_BUDGET_MS,
    );
  });

  it("a discarded cycle keeps sessions and segments and is not a completed Pomodoro", () => {
    const discarded = discardCycle(started(), T0 + 3_000).cycle;
    expect(discarded.sessions[0]?.segments.length).toBeGreaterThan(0);
    expect(isCountedCompletedPomodoro(discarded)).toBe(false);
    expect(startBreak(T0).running).toBe(true);
  });
});
