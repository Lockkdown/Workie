import { describe, expect, it } from "vitest";
import {
  createDayPlan,
  createFixedTaskBlock,
  createFlexibleReserveBlock,
  createFlexibleTaskBlock,
  leftovers,
  packDay,
  sameDerivedTimes,
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

describe("forward packing [D25]", () => {
  it("packs each flexible chain forward from the day edge, preserving order and duration", () => {
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
        durationMs: 2 * HOUR,
        chainPosition: 1,
        precedingAnchorId: null,
      }),
    ]);
    const packed = packDay(plan);
    const a = packed.blocks.find((block) => block.id === "a");
    const b = packed.blocks.find((block) => block.id === "b");
    expect(a?.derivedStartMs).toBe(dayStart);
    expect(a?.derivedEndMs).toBe(dayStart + HOUR);
    expect(b?.derivedStartMs).toBe(dayStart + HOUR);
    expect(b?.derivedEndMs).toBe(dayStart + 3 * HOUR);
  });

  it("packs a chain from the preceding hard anchor, not the day edge", () => {
    const meeting = createFixedTaskBlock({
      id: "meet",
      taskId: "t-meet",
      day: DAY,
      startMs: noon,
      endMs: noon + HOUR,
    });
    const plan = createDayPlan(DAY, [
      meeting,
      createFlexibleTaskBlock({
        id: "after",
        taskId: "t-after",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 0,
        precedingAnchorId: "meet",
      }),
    ]);
    const packed = packDay(plan);
    const after = packed.blocks.find((block) => block.id === "after");
    expect(after?.derivedStartMs).toBe(noon + HOUR);
    expect(after?.derivedEndMs).toBe(noon + 2 * HOUR);
    const meet = packed.blocks.find((block) => block.id === "meet");
    expect(meet?.derivedStartMs).toBe(noon);
    expect(meet?.derivedEndMs).toBe(noon + HOUR);
  });

  it("sits leftover time immediately before the next anchor, not scattered", () => {
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
    const a = packed.blocks.find((block) => block.id === "a");
    const b = packed.blocks.find((block) => block.id === "b");
    expect(a?.derivedEndMs).toBe(b?.derivedStartMs);
    const left = leftovers(packed).find((span) => span.nextAnchorId === "meet");
    expect(left?.startMs).toBe(b?.derivedEndMs);
    expect(left?.endMs).toBe(noon);
    expect(left?.endMs).toBe(
      packed.blocks.find((block) => block.id === "meet")?.derivedStartMs,
    );
  });

  it("does not change derived times when the clock advances", () => {
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
    const first = packDay(plan);
    const laterClock = noon + 3 * HOUR;
    expect(laterClock).toBeGreaterThan(dayStart);
    const second = packDay(plan);
    expect(sameDerivedTimes(first, second)).toBe(true);
    expect(packDay.length).toBe(1);
  });

  it("stops a chain at the next hard anchor instead of packing past it [D27]", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: 13 * HOUR,
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
    const meet = packed.blocks.find((block) => block.id === "meet");
    const b = packed.blocks.find((block) => block.id === "b");
    expect(meet?.derivedStartMs).toBe(noon);
    expect(meet?.derivedEndMs).toBe(noon + HOUR);
    expect(b?.derivedStartMs).toBe(noon);
    expect(b?.derivedStartMs).toBeLessThan(noon + HOUR);
  });

  it("packs reserve flexible blocks with the same duration and order rules [D29]", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "work",
        taskId: "t",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
      createFlexibleReserveBlock({
        id: "lunch",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 1,
        precedingAnchorId: null,
      }),
    ]);
    const packed = packDay(plan);
    const lunch = packed.blocks.find((block) => block.id === "lunch");
    expect(lunch?.kind).toBe("reserve");
    expect(lunch?.derivedStartMs).toBe(dayStart + HOUR);
    expect(lunch?.derivedEndMs).toBe(dayStart + 2 * HOUR);
    expect(lunch).not.toHaveProperty("taskId");
    expect(lunch).not.toHaveProperty("status");
  });
});
