import { describe, expect, it } from "vitest";
import {
  evaluateDayBoundary,
  isOverloadDueToMidnightCrossing,
  isSpanRunningAt,
  mayStartBlockForWorkieDay,
  workieDayOfBlock,
} from "./dayBoundary";
import { workieDayKey } from "./workieDay";

function local(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

describe("Workie day boundary [D31] [D100]", () => {
  it("closes the old day immediately when nothing is running at 00:00", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const result = evaluateDayBoundary(midnight);
    expect(result.currentWorkieDay).toBe("2026-01-15");
    expect(result.previousWorkieDay).toBe("2026-01-14");
    expect(result.previousDayClosed).toBe(true);
    expect(result.previousDayProvisional).toBe(false);
    expect(result.runningBlockStaysInPreviousDay).toBe(false);
    expect(result.mayStartPreviousDayBlock).toBe(false);
    expect(mayStartBlockForWorkieDay("2026-01-14", midnight)).toBe(false);
    expect(mayStartBlockForWorkieDay("2026-01-15", midnight)).toBe(true);
  });

  it("keeps a planned block running across 00:00 in the old day, unsplit, not overload", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const block = {
      startedAt: local(2026, 0, 14, 23, 0),
      endsAt: local(2026, 0, 15, 1, 0),
    };
    const result = evaluateDayBoundary(midnight, { runningBlock: block });
    expect(result.previousDayClosed).toBe(false);
    expect(result.runningBlockStaysInPreviousDay).toBe(true);
    expect(result.runningBlockSplit).toBe(false);
    expect(result.runningBlockOverloadDueToMidnight).toBe(false);
    expect(isOverloadDueToMidnightCrossing()).toBe(false);
    expect(workieDayOfBlock(block)).toBe("2026-01-14");
    expect(workieDayKey(block.endsAt)).toBe("2026-01-15");
    expect(mayStartBlockForWorkieDay("2026-01-14", midnight)).toBe(false);
    expect(isSpanRunningAt(block, midnight)).toBe(true);

    const afterEnd = evaluateDayBoundary(local(2026, 0, 15, 1, 0), {
      runningBlock: block,
    });
    expect(afterEnd.previousDayClosed).toBe(true);
    expect(afterEnd.runningBlockStaysInPreviousDay).toBe(false);
  });

  it("extends the old day for a focus session running across 00:00", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const session = {
      startedAt: local(2026, 0, 14, 23, 30),
    };
    const result = evaluateDayBoundary(midnight, { runningSession: session });
    expect(result.previousDayClosed).toBe(false);
    expect(result.runningSessionStaysInPreviousDay).toBe(true);
    expect(result.runningBlockSplit).toBe(false);
    expect(mayStartBlockForWorkieDay("2026-01-14", midnight)).toBe(false);
  });

  it("treats a cycle awaiting reconciliation at 00:00 as running [D100]", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const result = evaluateDayBoundary(midnight, {
      unfinishedCycleStatus: "awaiting reconciliation",
    });
    expect(result.previousDayClosed).toBe(false);
    expect(result.previousDayProvisional).toBe(true);
    expect(result.mayStartPreviousDayBlock).toBe(false);

    const later = evaluateDayBoundary(local(2026, 0, 15, 10, 0), {
      unfinishedCycleStatus: "awaiting reconciliation",
    });
    expect(later.previousDayProvisional).toBe(true);
    expect(later.previousDayClosed).toBe(false);

    const reconciled = evaluateDayBoundary(local(2026, 0, 15, 10, 0), {});
    expect(reconciled.previousDayClosed).toBe(true);
    expect(reconciled.previousDayProvisional).toBe(false);
  });
});
