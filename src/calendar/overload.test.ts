import { describe, expect, it } from "vitest";
import {
  createDayPlan,
  createFixedTaskBlock,
  createFlexibleTaskBlock,
  evaluateOverload,
  resolveConflict,
  setRunningBlock,
} from "./index";
import { applyOverrunPush, packDay, packedById } from "./index";

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

const noon = local(2026, 5, 15, 12);

describe("overload [D30]", () => {
  it("is true when two fixed blocks overlap, and does not move them", () => {
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
    const overlap = report.issues.find(
      (issue) => issue.kind === "overlappingFixed",
    );
    expect(overlap?.kind === "overlappingFixed" && overlap.blockIds).toEqual([
      "f1",
      "f2",
    ]);
    const f1 = plan.blocks.find((block) => block.id === "f1");
    const f2 = plan.blocks.find((block) => block.id === "f2");
    expect(f1).toEqual(a);
    expect(f2).toEqual(b);
  });

  it("is true when a flexible chain is longer than interval capacity", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: 8 * HOUR,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
      createFixedTaskBlock({
        id: "meet",
        taskId: "t-meet",
        day: DAY,
        startMs: local(2026, 5, 15, 6),
        endMs: local(2026, 5, 15, 7),
      }),
    ]);
    const report = evaluateOverload(plan);
    expect(report.overloaded).toBe(true);
    const issue = report.issues.find(
      (item) => item.kind === "chainExceedsCapacity",
    );
    expect(issue?.kind).toBe("chainExceedsCapacity");
    if (issue?.kind !== "chainExceedsCapacity") {
      return;
    }
    expect(issue.blockIds).toEqual(["a"]);
    expect(issue.chainDurationMs).toBe(8 * HOUR);
    expect(issue.capacityMs).toBe(6 * HOUR);
    expect(issue.span.startMs).toBe(local(2026, 5, 15));
    expect(issue.span.endMs).toBe(local(2026, 5, 15, 6));
  });

  it("is true for an unresolved, including deliberately kept, conflict", () => {
    const seeded = setRunningBlock(
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
    const meet = packedById(packDay(seeded), "meet");
    if (!meet) {
      throw new Error("missing meet");
    }
    const pushed = applyOverrunPush(
      seeded,
      meet.derivedEndMs + 150 * 60 * 1000,
    );
    expect(pushed.next.blocks.find((block) => block.id === "b")?.conflict).toBe(
      true,
    );
    const kept = resolveConflict(pushed.next, { resolution: "keepConflict" });
    const report = evaluateOverload(kept.next);
    expect(report.overloaded).toBe(true);
    expect(
      report.issues.some((issue) => issue.kind === "unresolvedConflict"),
    ).toBe(true);
    expect(
      kept.next.blocks.find((block) => block.id === "b")?.keptConflict,
    ).toBe(true);
    expect(kept.next.blocks.find((block) => block.id === "b")?.conflict).toBe(
      true,
    );
  });

  it("is false when none of the three conditions hold", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: HOUR,
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
    const report = evaluateOverload(plan);
    expect(report.overloaded).toBe(false);
    expect(report.issues).toEqual([]);
  });

  it("does not change with task count, priority, or difficulty", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
    ]);
    const report = evaluateOverload(plan);
    const again = evaluateOverload(plan);
    expect(report).toEqual(again);
    expect(evaluateOverload.length).toBe(1);
    expect(report.overloaded).toBe(false);
  });
});
