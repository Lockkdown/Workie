import { describe, expect, it } from "vitest";
import {
  CONFLICT_RESOLUTIONS,
  FIVE_MINUTES_MS,
  applyOverrunPush,
  createDayPlan,
  createFixedTaskBlock,
  createFlexibleTaskBlock,
  isFixedBlock,
  isFlexibleBlock,
  packDay,
  packedById,
  setRunningBlock,
  warnBeforeEnd,
} from "./index";

const DAY = "2026-06-15";
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

function local(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

const three = local(2026, 5, 15, 3);

function morningChainWithEarlyMeeting() {
  return createDayPlan(DAY, [
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
      startMs: three,
      endMs: three + HOUR,
    }),
  ]);
}

describe("five-minute warning [D1]", () => {
  it("warns when five minutes remain before the running block ends", () => {
    const plan = morningChainWithEarlyMeeting();
    const packed = packDay(plan);
    const a = packedById(packed, "a");
    expect(a).toBeDefined();
    if (!a) {
      return;
    }
    expect(warnBeforeEnd(a, a.derivedEndMs - FIVE_MINUTES_MS)).toBe(true);
    expect(warnBeforeEnd(a, a.derivedEndMs - FIVE_MINUTES_MS - 1)).toBe(false);
    expect(warnBeforeEnd(a, a.derivedEndMs)).toBe(false);
    expect(warnBeforeEnd(a, a.derivedStartMs - MIN)).toBe(false);
  });
});

describe("overrun push [D1] [D26] [D27]", () => {
  it("pushes later blocks up to the first hard anchor and no further", () => {
    const plan = setRunningBlock(morningChainWithEarlyMeeting(), "a");
    const packedBefore = packDay(plan);
    const aBefore = packedById(packedBefore, "a");
    expect(aBefore).toBeDefined();
    if (!aBefore) {
      return;
    }
    const now = aBefore.derivedEndMs + 3 * HOUR;
    const pushed = applyOverrunPush(plan, now);
    const packed = packDay(pushed.next);
    const meet = packedById(packed, "meet");
    const b = packedById(packed, "b");
    const a = packedById(packed, "a");
    expect(meet?.derivedStartMs).toBe(three);
    expect(meet?.derivedEndMs).toBe(three + HOUR);
    expect(b?.derivedStartMs).toBeLessThan(three + HOUR);
    expect(b?.derivedStartMs).toBeLessThanOrEqual(three);
    expect(a?.derivedEndMs).toBeGreaterThan(three);
    const afterMeeting = packed.blocks.filter(
      (block) =>
        block.id !== "meet" &&
        block.derivedStartMs >= three + HOUR &&
        plan.blocks.some(
          (item) => item.id === block.id && item.type === "flexible",
        ),
    );
    expect(afterMeeting).toHaveLength(0);
  });

  it("stops at the anchor, keeps it, and marks the colliding block plus the affected chain", () => {
    const plan = setRunningBlock(morningChainWithEarlyMeeting(), "a");
    const aBefore = packedById(packDay(plan), "a");
    if (!aBefore) {
      throw new Error("missing a");
    }
    const pushed = applyOverrunPush(plan, aBefore.derivedEndMs + 4 * HOUR);
    const b = pushed.next.blocks.find((block) => block.id === "b");
    const meet = pushed.next.blocks.find((block) => block.id === "meet");
    expect(b?.conflict).toBe(true);
    expect(meet && isFixedBlock(meet) && meet.startMs === three).toBe(true);
    expect(pushed.conflicts.length).toBeGreaterThan(0);
    expect(pushed.conflicts[0]?.anchorId).toBe("meet");
    expect(pushed.conflicts[0]?.affectedBlockIds).toContain("b");
  });

  it("exposes the five resolutions and applies none of them on its own", () => {
    expect([...CONFLICT_RESOLUTIONS]).toEqual([
      "changeDuration",
      "changeOrder",
      "moveBlockPastAnchor",
      "unscheduleBlock",
      "keepConflict",
    ]);
    const plan = setRunningBlock(morningChainWithEarlyMeeting(), "a");
    const aBefore = packedById(packDay(plan), "a");
    if (!aBefore) {
      throw new Error("missing a");
    }
    const idsBefore = plan.blocks.map((block) => block.id).sort();
    const durationsBefore = new Map(
      plan.blocks.map((block) => [block.id, block.durationMs]),
    );
    const pushed = applyOverrunPush(plan, aBefore.derivedEndMs + 4 * HOUR);
    const idsAfter = pushed.next.blocks.map((block) => block.id).sort();
    expect(idsAfter).toEqual(idsBefore);
    for (const block of pushed.next.blocks) {
      if (block.id === "a") {
        expect(block.durationMs).toBeGreaterThan(durationsBefore.get("a") ?? 0);
        continue;
      }
      expect(block.durationMs).toBe(durationsBefore.get(block.id));
    }
    const bBlock = pushed.next.blocks.find((block) => block.id === "b");
    expect(bBlock && isFlexibleBlock(bBlock) && bBlock.precedingAnchorId).toBe(
      null,
    );
  });

  it("never splits, shortens, or unschedules on its own", () => {
    const plan = setRunningBlock(morningChainWithEarlyMeeting(), "a");
    const aBefore = packedById(packDay(plan), "a");
    if (!aBefore) {
      throw new Error("missing a");
    }
    const pushed = applyOverrunPush(plan, aBefore.derivedEndMs + 5 * HOUR);
    expect(pushed.next.blocks).toHaveLength(plan.blocks.length);
    for (const original of plan.blocks) {
      const next = pushed.next.blocks.find((block) => block.id === original.id);
      expect(next).toBeDefined();
      if (!next) {
        continue;
      }
      if (original.id !== "a") {
        expect(next.durationMs).toBeGreaterThanOrEqual(original.durationMs);
      }
    }
  });

  it("does not move a fixed block's start or end", () => {
    const plan = setRunningBlock(morningChainWithEarlyMeeting(), "a");
    const aBefore = packedById(packDay(plan), "a");
    if (!aBefore) {
      throw new Error("missing a");
    }
    const pushed = applyOverrunPush(plan, aBefore.derivedEndMs + HOUR);
    const meet = pushed.next.blocks.find((block) => block.id === "meet");
    expect(meet && isFixedBlock(meet) && meet.startMs === three).toBe(true);
    expect(meet && isFixedBlock(meet) && meet.endMs === three + HOUR).toBe(
      true,
    );
  });
});
