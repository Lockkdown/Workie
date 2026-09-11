import { describe, expect, it } from "vitest";
import {
  attributeBlockDay,
  createDayPlan,
  createFixedTaskBlock,
  evaluateCalendarDayClose,
  evaluateOverload,
  mayStartBlockOnDay,
  midnightCrossingIsOverload,
  packDay,
} from "./index";

function local(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

const OLD_DAY = "2026-01-14";
const NEW_DAY = "2026-01-15";

describe("day close [D31] [D100]", () => {
  it("closes immediately when nothing is running at 00:00", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const result = evaluateCalendarDayClose(midnight);
    expect(result.previousDayClosed).toBe(true);
    expect(result.previousDayProvisional).toBe(false);
    expect(result.currentWorkieDay).toBe(NEW_DAY);
    expect(result.previousWorkieDay).toBe(OLD_DAY);
    expect(result.mayStartPreviousDayBlock).toBe(false);
    expect(mayStartBlockOnDay(OLD_DAY, midnight)).toBe(false);
    expect(mayStartBlockOnDay(NEW_DAY, midnight)).toBe(true);
  });

  it("keeps a 23:50–00:20 block on the old day, unsplit, not overload-for-late, and closes when it ends", () => {
    const start = local(2026, 0, 14, 23, 50);
    const end = local(2026, 0, 15, 0, 20);
    const block = createFixedTaskBlock({
      id: "late",
      taskId: "t",
      day: OLD_DAY,
      startMs: start,
      endMs: end,
    });
    const plan = createDayPlan(OLD_DAY, [block], { runningBlockId: "late" });
    const midnight = local(2026, 0, 15, 0, 0);
    const during = evaluateCalendarDayClose(midnight, {
      plan,
      runningBlockId: "late",
    });
    expect(during.previousDayClosed).toBe(false);
    expect(during.runningBlockStaysInPreviousDay).toBe(true);
    expect(during.runningBlockSplit).toBe(false);
    expect(during.runningBlockOverloadDueToMidnight).toBe(false);
    expect(midnightCrossingIsOverload()).toBe(false);
    expect(evaluateOverload(plan).overloaded).toBe(false);
    expect(packDay(plan).blocks).toHaveLength(1);
    expect(attributeBlockDay({ startedAt: start }, midnight, true)).toBe(
      OLD_DAY,
    );

    const afterEnd = evaluateCalendarDayClose(end, {
      plan,
      runningBlockId: "late",
    });
    expect(afterEnd.previousDayClosed).toBe(true);
    expect(afterEnd.runningBlockStaysInPreviousDay).toBe(false);
  });

  it("attributes a block not yet started at 00:30 to the new day", () => {
    const start = local(2026, 0, 15, 0, 30);
    const at0030 = local(2026, 0, 15, 0, 30);
    expect(attributeBlockDay({ startedAt: start }, at0030, false)).toBe(
      NEW_DAY,
    );
    expect(mayStartBlockOnDay(OLD_DAY, at0030)).toBe(false);
    const block = createFixedTaskBlock({
      id: "morning",
      taskId: "t",
      day: NEW_DAY,
      startMs: start,
      endMs: local(2026, 0, 15, 1, 0),
    });
    expect(block.day).toBe(NEW_DAY);
    const close = evaluateCalendarDayClose(at0030, {
      plan: createDayPlan(NEW_DAY, [block]),
    });
    expect(close.currentWorkieDay).toBe(NEW_DAY);
    expect(close.previousDayClosed).toBe(true);
    expect(close.mayStartPreviousDayBlock).toBe(false);
  });

  it("extends close while a focus session with no block runs across midnight [D31] [D39]", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const result = evaluateCalendarDayClose(midnight, {
      runningSession: { startedAt: local(2026, 0, 14, 23, 30) },
    });
    expect(result.previousDayClosed).toBe(false);
    expect(result.runningSessionStaysInPreviousDay).toBe(true);
  });

  it("treats awaiting reconciliation as running so the old day stays provisional [D100]", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const result = evaluateCalendarDayClose(midnight, {
      unfinishedCycleStatus: "awaiting reconciliation",
    });
    expect(result.previousDayClosed).toBe(false);
    expect(result.previousDayProvisional).toBe(true);
  });
});
