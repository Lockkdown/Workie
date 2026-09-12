import { remainingMs } from "../domain/remainingTime";
import { workieDayKey } from "../domain/workieDay";
import { describe, expect, it } from "vitest";
import {
  beginSwitch,
  budgetEndsAt,
  confirmedFocusMs,
  cycleDoesNotStopForBlockEnd,
  discardCycle,
  findUnfinished,
  isCountedCompletedPomodoro,
  loseObservation,
  noteCertain,
  pauseCycle,
  prepareContext,
  recoverRunningOnLoad,
  reconcile,
  remainingBudgetMs,
  resumeOnTask,
  resumePaused,
  sessionsOverlap,
  shouldPushCalendar,
  startBreak,
  startCycle,
  stopEarly,
  tickBreak,
  tickRunning,
  unfinishedCount,
} from "./engine";
import { BREAK_MS, DEFAULT_BUDGET_MS } from "./types";
import type { EngineIds, PomodoroCycle } from "./types";

const T0 = new Date(2026, 8, 14, 10, 0, 0, 0).getTime();

function ids(n: number): EngineIds {
  return {
    cycleId: `c${n}`,
    sessionId: `s${n}`,
    segmentId: `g${n}`,
  };
}

function startAt(
  now = T0,
  taskId = "task-a",
  blockId: string | null = "block-a",
  budget = DEFAULT_BUDGET_MS,
): PomodoroCycle {
  const result = startCycle(
    [],
    prepareContext({ taskId, blockId, defaultBudgetMs: budget }),
    now,
    ids(1),
  );
  if (!result.ok) {
    throw new Error("expected start");
  }
  return result.cycle;
}

describe("prepare vs start [D41]", () => {
  it("preparing a task creates no cycle and no focus time", () => {
    const prepared = prepareContext({ taskId: "task-a" });
    expect(prepared.taskId).toBe("task-a");
    expect(prepared.blockId).toBeNull();
    expect(unfinishedCount([])).toBe(0);
    expect(confirmedFocusMs(startAt(), T0)).toBe(0);
  });

  it("Start snapshots the budget, opens the first session, and runs", () => {
    const cycle = startAt();
    expect(cycle.state).toBe("running");
    expect(cycle.budgetMs).toBe(DEFAULT_BUDGET_MS);
    expect(cycle.sessions).toHaveLength(1);
    expect(cycle.sessions[0]?.taskId).toBe("task-a");
    expect(cycle.sessions[0]?.blockId).toBe("block-a");
    expect(cycle.outcome).toBeNull();
  });
});

describe("budget [D42]", () => {
  it("uses 30 minutes on a fresh install", () => {
    expect(DEFAULT_BUDGET_MS).toBe(30 * 60 * 1000);
    expect(startAt().budgetMs).toBe(30 * 60 * 1000);
  });

  it("a later default does not change a paused cycle", () => {
    const running = startAt(T0, "task-a", null, 30 * 60 * 1000);
    const paused = pauseCycle(running, T0 + 60_000);
    const later = startCycle(
      [paused],
      prepareContext({ taskId: "task-b", defaultBudgetMs: 50 * 60 * 1000 }),
      T0 + 120_000,
      ids(2),
    );
    expect(later.ok).toBe(false);
    if (!later.ok) {
      expect(later.cycle.budgetMs).toBe(30 * 60 * 1000);
    }
  });
});

describe("pause and switch time [D36] [D38]", () => {
  it("does not count pause time as focus", () => {
    const running = startAt();
    const paused = pauseCycle(running, T0 + 5 * 60_000);
    expect(confirmedFocusMs(paused, T0 + 10 * 60_000)).toBe(5 * 60_000);
    const resumed = resumePaused(paused, T0 + 10 * 60_000, "g-resume");
    expect(confirmedFocusMs(resumed, T0 + 12 * 60_000)).toBe(7 * 60_000);
  });

  it("does not count task-switch time as focus", () => {
    const running = startAt();
    const switching = beginSwitch(running, T0 + 4 * 60_000);
    expect(switching.state).toBe("awaiting task selection");
    expect(switching.sessions[0]?.closeReason).toBe("Switched task");
    expect(confirmedFocusMs(switching, T0 + 20 * 60_000)).toBe(4 * 60_000);
    const resumed = resumeOnTask(switching, {
      taskId: "task-b",
      blockId: null,
      now: T0 + 20 * 60_000,
      ids: { sessionId: "s2", segmentId: "g2" },
    });
    expect(resumed.sessions).toHaveLength(2);
    expect(resumed.sessions[1]?.taskId).toBe("task-b");
    expect(confirmedFocusMs(resumed, T0 + 21 * 60_000)).toBe(5 * 60_000);
    expect(sessionsOverlap(resumed)).toBe(false);
  });

  it("never starts the next session until Resume", () => {
    const switching = beginSwitch(startAt(), T0 + 1_000);
    expect(switching.currentSessionId).toBeNull();
    expect(switching.sessions).toHaveLength(1);
  });
});

describe("one unfinished cycle [D40]", () => {
  it("returns the existing cycle instead of starting a second one", () => {
    const first = startAt();
    const second = startCycle(
      [first],
      prepareContext({ taskId: "task-b" }),
      T0 + 1_000,
      ids(2),
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.cycle.id).toBe(first.id);
    }
    expect(findUnfinished([first])?.id).toBe(first.id);
  });

  it.each([
    "running",
    "paused",
    "awaiting task selection",
    "awaiting reconciliation",
  ] as const)("blocks a second start while %s", (state) => {
    let cycle = startAt();
    if (state === "paused") {
      cycle = pauseCycle(cycle, T0 + 1_000);
    }
    if (state === "awaiting task selection") {
      cycle = beginSwitch(cycle, T0 + 1_000);
    }
    if (state === "awaiting reconciliation") {
      cycle = loseObservation(cycle, T0 + 1_000);
    }
    const blocked = startCycle(
      [cycle],
      prepareContext({ taskId: "other" }),
      T0 + 2_000,
      ids(9),
    );
    expect(blocked.ok).toBe(false);
    expect(cycle.state).toBe(state);
  });
});

describe("outcomes [D36] [D44]", () => {
  it("ends at zero with Timer complete and no overtime", () => {
    const cycle = startAt(T0, "task-a", "block-a", 10 * 60_000);
    const done = tickRunning(cycle, T0 + 10 * 60_000);
    expect(done.state).toBe("ended");
    expect(done.outcome).toBe("Timer complete");
    expect(confirmedFocusMs(done, T0 + 30 * 60_000)).toBe(10 * 60_000);
    expect(done.sessions[0]?.closeReason).toBe("Cycle ended");
    expect(done.sessions[0]?.taskId).toBe("task-a");
  });

  it("Stopped early and Discarded belong to the cycle", () => {
    const stopped = stopEarly(startAt(), T0 + 2_000);
    expect(stopped.outcome).toBe("Stopped early");
    expect(
      stopped.sessions.every(
        (session) =>
          session.closeReason === "Cycle ended" ||
          session.closeReason === "Switched task",
      ),
    ).toBe(true);
    const discarded = discardCycle(startAt(), T0 + 2_000).cycle;
    expect(discarded.outcome).toBe("Discarded");
    expect(discarded.sessions).toHaveLength(1);
    expect(discarded.sessions[0]?.segments.length).toBeGreaterThan(0);
    expect(isCountedCompletedPomodoro(discarded)).toBe(false);
  });

  it("time between two cycles is not focus time", () => {
    const first = tickRunning(startAt(T0, "a", null, 60_000), T0 + 60_000);
    expect(isCountedCompletedPomodoro(first)).toBe(true);
    const gapEnd = T0 + 5 * 60_000;
    const second = startCycle(
      [first],
      prepareContext({ taskId: "b" }),
      gapEnd,
      ids(2),
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(confirmedFocusMs(second.cycle, gapEnd)).toBe(0);
    }
  });
});

describe("reconciliation [D37] [D31] [D100]", () => {
  it("reload leaves the cycle awaiting reconciliation with last certain moment", () => {
    const running = noteCertain(startAt(), T0 + 3_000);
    const lost = recoverRunningOnLoad(running, T0 + 9_000);
    expect(lost.state).toBe("awaiting reconciliation");
    expect(lost.lastCertainAt).toBe(T0 + 3_000);
    expect(isCountedCompletedPomodoro(lost)).toBe(false);
  });

  it("count-the-gap-as-focus credits the current session", () => {
    const lost = loseObservation(startAt(), T0 + 2 * 60_000);
    const next = reconcile(lost, "focus", T0 + 5 * 60_000, "gap").cycle;
    expect(next.state).toBe("running");
    expect(confirmedFocusMs(next, T0 + 5 * 60_000)).toBe(5 * 60_000);
    expect(next.sessions).toHaveLength(1);
  });

  it("count-the-gap-as-pause does not credit the gap", () => {
    const lost = loseObservation(startAt(), T0 + 2 * 60_000);
    const next = reconcile(lost, "pause", T0 + 8 * 60_000, "resume").cycle;
    expect(next.state).toBe("running");
    expect(confirmedFocusMs(next, T0 + 8 * 60_000)).toBe(2 * 60_000);
  });

  it("confirm interruption discards and keeps certain focus", () => {
    const lost = loseObservation(startAt(), T0 + 2 * 60_000);
    const next = reconcile(lost, "discard", T0 + 9 * 60_000, "x");
    expect(next.cycle.outcome).toBe("Discarded");
    expect(confirmedFocusMs(next.cycle, T0 + 9 * 60_000)).toBe(2 * 60_000);
    expect(isCountedCompletedPomodoro(next.cycle)).toBe(false);
  });

  it("credits a gap across 00:00 to the old day with no extra session", () => {
    const late = new Date(2026, 8, 14, 23, 50, 0, 0).getTime();
    const after = new Date(2026, 8, 15, 0, 10, 0, 0).getTime();
    const lost = loseObservation(startAt(late), late + 60_000);
    const next = reconcile(lost, "focus", after, "gap").cycle;
    expect(next.workieDay).toBe(workieDayKey(late));
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]?.workieDay).toBe(workieDayKey(late));
    expect(next.workieDay).not.toBe(workieDayKey(after));
  });

  it("discarding after 00:00 asks the old day to close once", () => {
    const late = new Date(2026, 8, 14, 23, 50, 0, 0).getTime();
    const after = new Date(2026, 8, 15, 0, 10, 0, 0).getTime();
    const lost = loseObservation(startAt(late), late + 60_000);
    const next = reconcile(lost, "discard", after, "x");
    expect(next.closeProvisionalDay).toBe(true);
    expect(next.cycle.workieDay).toBe(workieDayKey(late));
  });

  it("counting the gap as focus keeps the session on the old day", () => {
    const late = new Date(2026, 8, 14, 23, 50, 0, 0).getTime();
    const after = new Date(2026, 8, 15, 0, 5, 0, 0).getTime();
    const next = reconcile(
      loseObservation(startAt(late), late + 30_000),
      "focus",
      after,
      "gap",
    ).cycle;
    expect(next.workieDay).toBe(workieDayKey(late));
    expect(next.sessions[0]?.workieDay).toBe(workieDayKey(late));
  });
});

describe("calendar link [D39]", () => {
  it("records Unscheduled when no block is chosen", () => {
    const cycle = startAt(T0, "task-a", null);
    expect(cycle.sessions[0]?.blockId).toBeNull();
    expect(
      shouldPushCalendar({
        session: cycle.sessions[0]!,
        blockEndMs: T0 + 10_000,
        now: T0 + 20_000,
      }),
    ).toBe(false);
  });

  it("a referenced block ending does not stop the cycle", () => {
    const cycle = startAt();
    expect(cycleDoesNotStopForBlockEnd()).toBe(true);
    expect(tickRunning(cycle, T0 + 1_000).state).toBe("running");
  });

  it("does not shorten, split or unschedule a block", () => {
    const cycle = startAt();
    expect(cycle.sessions[0]?.blockId).toBe("block-a");
    const ended = stopEarly(cycle, T0 + 1_000);
    expect(ended.sessions[0]?.blockId).toBe("block-a");
  });
});

describe("break [D43]", () => {
  it("is 5 minutes, offered not started, and skippable", () => {
    const offered = startBreak(T0);
    expect(offered.durationMs).toBe(BREAK_MS);
    expect(tickBreak(offered, T0 + BREAK_MS).running).toBe(false);
  });
});

describe("timer from durable timestamps [D98]", () => {
  it("remaining time is derived from timestamps, not ticks", () => {
    const cycle = startAt(T0, "a", null, 10 * 60_000);
    const ends = budgetEndsAt(cycle);
    expect(ends).toBe(T0 + 10 * 60_000);
    expect(remainingMs(ends!, T0 + 2 * 60_000)).toBe(8 * 60_000);
    expect(remainingBudgetMs(cycle, T0 + 2 * 60_000)).toBe(8 * 60_000);
  });
});
