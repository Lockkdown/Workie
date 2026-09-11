import { describe, expect, it } from "vitest";
import {
  applyOverrunPush,
  attributeBlockDay,
  createDayPlan,
  createFixedTaskBlock,
  createFlexibleTaskBlock,
  createReserve,
  dragFlexibleBody,
  evaluateCalendarDayClose,
  evaluateOverload,
  leftovers,
  midnightCrossingIsOverload,
  packDay,
  packedById,
  resolveConflict,
  setRunningBlock,
} from "./index";

const DAY = "2026-06-15";
const HOUR = 60 * 60 * 1000;

function local(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

const dayStart = local(2026, 5, 15);
const noon = local(2026, 5, 15, 12);

describe("F4 edge cases", () => {
  it("two fixed blocks the user placed overlapping: reported as overload; Workie does not move either one [D26] [D30]", () => {
    const a = createFixedTaskBlock({
      id: "f1",
      taskId: "t1",
      day: DAY,
      startMs: noon,
      endMs: noon + 2 * HOUR,
    });
    const b = createFixedTaskBlock({
      id: "f2",
      taskId: "t2",
      day: DAY,
      startMs: noon + HOUR,
      endMs: noon + 3 * HOUR,
    });
    const plan = createDayPlan(DAY, [a, b]);
    const report = evaluateOverload(plan);
    expect(report.overloaded).toBe(true);
    expect(
      report.issues.some((issue) => issue.kind === "overlappingFixed"),
    ).toBe(true);
    expect(plan.blocks.find((block) => block.id === "f1")).toEqual(a);
    expect(plan.blocks.find((block) => block.id === "f2")).toEqual(b);
  });

  it("a chain longer than its anchor interval: reported as overload, naming the blocks and the span [D30]", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: 13 * HOUR,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
      createFixedTaskBlock({
        id: "meet",
        taskId: "t-meet",
        day: DAY,
        startMs: noon,
        endMs: noon + HOUR,
      }),
    ]);
    const issue = evaluateOverload(plan).issues.find(
      (item) => item.kind === "chainExceedsCapacity",
    );
    expect(issue?.kind).toBe("chainExceedsCapacity");
    if (issue?.kind !== "chainExceedsCapacity") {
      return;
    }
    expect(issue.blockIds).toEqual(["a"]);
    expect(issue.span).toEqual({ startMs: dayStart, endMs: noon });
    expect(issue.chainDurationMs).toBeGreaterThan(issue.capacityMs);
  });

  it("a conflict the user deliberately keeps: it stays marked and the day stays overloaded [D20] [D27] [D30]", () => {
    const plan = setRunningBlock(
      createDayPlan(DAY, [
        createFlexibleTaskBlock({
          id: "a",
          taskId: "t-a",
          day: DAY,
          durationMs: HOUR,
          chainPosition: 0,
          precedingAnchorId: null,
        }),
        createFlexibleTaskBlock({
          id: "b",
          taskId: "t-b",
          day: DAY,
          durationMs: 2 * HOUR,
          chainPosition: 0,
          precedingAnchorId: "meet",
        }),
        createFixedTaskBlock({
          id: "meet",
          taskId: "t-meet",
          day: DAY,
          startMs: noon,
          endMs: noon + HOUR,
        }),
        createFixedTaskBlock({
          id: "later",
          taskId: "t-later",
          day: DAY,
          startMs: local(2026, 5, 15, 16),
          endMs: local(2026, 5, 15, 17),
        }),
      ]),
      "meet",
    );
    const meet = packedById(packDay(plan), "meet");
    if (!meet) {
      throw new Error("missing meet");
    }
    const pushed = applyOverrunPush(plan, meet.derivedEndMs + 150 * 60 * 1000);
    const kept = resolveConflict(pushed.next, { resolution: "keepConflict" });
    expect(kept.next.blocks.find((block) => block.id === "b")?.conflict).toBe(
      true,
    );
    expect(
      kept.next.blocks.find((block) => block.id === "b")?.keptConflict,
    ).toBe(true);
    expect(evaluateOverload(kept.next).overloaded).toBe(true);
  });

  it("a flexible block dragged into another chain: derived times of both chains are recomputed and previewed before applying [D28]", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
      createFlexibleTaskBlock({
        id: "b",
        taskId: "t-b",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 1,
        precedingAnchorId: null,
      }),
      createFixedTaskBlock({
        id: "meet",
        taskId: "t-meet",
        day: DAY,
        startMs: noon,
        endMs: noon + HOUR,
      }),
      createFlexibleTaskBlock({
        id: "c",
        taskId: "t-c",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 0,
        precedingAnchorId: "meet",
      }),
    ]);
    const before = packDay(plan);
    const preview = dragFlexibleBody(
      plan,
      "b",
      { precedingAnchorId: "meet", chainPosition: 0 },
      { confirmed: false },
    );
    expect(preview.confirmed).toBe(false);
    expect(preview.affectedChains).toEqual(
      expect.arrayContaining([null, "meet"]),
    );
    expect(packedById(packDay(plan), "b")?.derivedStartMs).toBe(
      packedById(before, "b")?.derivedStartMs,
    );
    const nextPacked = packDay(preview.next);
    expect(packedById(nextPacked, "a")?.derivedStartMs).toBe(dayStart);
    expect(packedById(nextPacked, "a")?.derivedEndMs).toBe(dayStart + HOUR);
    expect(packedById(nextPacked, "b")?.derivedStartMs).toBe(noon + HOUR);
    expect(packedById(nextPacked, "c")?.derivedStartMs).toBe(noon + 2 * HOUR);
  });

  it("overrun with no anchor ahead: the chain simply packs forward; no conflict arises until an anchor is reached [D25] [D27]", () => {
    const plan = setRunningBlock(
      createDayPlan(DAY, [
        createFlexibleTaskBlock({
          id: "a",
          taskId: "t-a",
          day: DAY,
          durationMs: HOUR,
          chainPosition: 0,
          precedingAnchorId: null,
        }),
        createFlexibleTaskBlock({
          id: "b",
          taskId: "t-b",
          day: DAY,
          durationMs: HOUR,
          chainPosition: 1,
          precedingAnchorId: null,
        }),
      ]),
      "a",
    );
    const a = packedById(packDay(plan), "a");
    if (!a) {
      throw new Error("missing a");
    }
    const pushed = applyOverrunPush(plan, a.derivedEndMs + 2 * HOUR);
    expect(pushed.conflicts).toEqual([]);
    expect(pushed.next.blocks.every((block) => !block.conflict)).toBe(true);
    const packed = packDay(pushed.next);
    expect(packedById(packed, "b")?.derivedStartMs).toBe(
      a.derivedEndMs + 2 * HOUR,
    );
  });

  it("a block running 23:50 to 00:20: it stays in the old day, is not split, and the day closes when it ends [D31]", () => {
    const start = local(2026, 0, 14, 23, 50);
    const end = local(2026, 0, 15, 0, 20);
    const plan = createDayPlan("2026-01-14", [
      createFixedTaskBlock({
        id: "late",
        taskId: "t",
        day: "2026-01-14",
        startMs: start,
        endMs: end,
      }),
    ]);
    const midnight = local(2026, 0, 15, 0, 0);
    const during = evaluateCalendarDayClose(midnight, {
      plan: setRunningBlock(plan, "late"),
    });
    expect(during.runningBlockStaysInPreviousDay).toBe(true);
    expect(during.runningBlockSplit).toBe(false);
    expect(packDay(plan).blocks).toHaveLength(1);
    expect(evaluateOverload(plan).overloaded).toBe(false);
    expect(midnightCrossingIsOverload()).toBe(false);
    expect(
      evaluateCalendarDayClose(end, { plan: setRunningBlock(plan, "late") })
        .previousDayClosed,
    ).toBe(true);
  });

  it("a block not yet started at 00:30: it belongs to the new day [D31]", () => {
    const at0030 = local(2026, 0, 15, 0, 30);
    expect(attributeBlockDay({ startedAt: at0030 }, at0030, false)).toBe(
      "2026-01-15",
    );
  });

  it("a focus session with no block, running across midnight: the running-session exception of [D31] applies [D31] [D39]", () => {
    const midnight = local(2026, 0, 15, 0, 0);
    const result = evaluateCalendarDayClose(midnight, {
      runningSession: { startedAt: local(2026, 0, 14, 23, 40) },
    });
    expect(result.runningSessionStaysInPreviousDay).toBe(true);
    expect(result.previousDayClosed).toBe(false);
  });

  it("a gap between two blocks: absorbed by packing, and never converted into a reserve block automatically [D29]", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
      createFlexibleTaskBlock({
        id: "b",
        taskId: "t-b",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 1,
        precedingAnchorId: null,
      }),
      createFixedTaskBlock({
        id: "meet",
        taskId: "t-meet",
        day: DAY,
        startMs: noon,
        endMs: noon + HOUR,
      }),
    ]);
    const packed = packDay(plan);
    expect(packedById(packed, "a")?.derivedEndMs).toBe(
      packedById(packed, "b")?.derivedStartMs,
    );
    const left = leftovers(packed).find((span) => span.nextAnchorId === "meet");
    expect(left?.startMs).toBe(packedById(packed, "b")?.derivedEndMs);
    expect(left?.endMs).toBe(noon);
    expect(
      packed.blocks.filter((block) => block.kind === "reserve"),
    ).toHaveLength(0);
    const afterGap = packDay(plan);
    expect(
      afterGap.blocks.filter((block) => block.kind === "reserve"),
    ).toHaveLength(0);
    expect(createReserve).toBeTypeOf("function");
  });
});
