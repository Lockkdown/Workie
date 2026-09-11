import { describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import {
  convertType,
  createDayPlan,
  createFixedReserveBlock,
  createFixedTaskBlock,
  createFlexibleTaskBlock,
  createReserve,
  dragEdge,
  dragFixedBody,
  dragFlexibleBody,
  editFixed,
  isFixedBlock,
  isFlexibleBlock,
  isReserveBlock,
  packDay,
  packedById,
  resolveConflict,
  scheduleTask,
  unschedule,
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
const source = { kind: "user" as const, accountId: "local" };

function twoChainPlan() {
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
}

describe("mutations preview [D23] [D28]", () => {
  it("returns next, conflicts, and affectedChains before apply, without mutating the input", () => {
    const plan = twoChainPlan();
    const snapshot = structuredClone(plan);
    const preview = dragFlexibleBody(
      plan,
      "b",
      { precedingAnchorId: "meet", chainPosition: 0 },
      { confirmed: false },
    );
    expect(plan).toEqual(snapshot);
    expect(preview.next).not.toBe(plan);
    expect(preview.confirmed).toBe(false);
    expect(preview.affectedChains).toContain(null);
    expect(preview.affectedChains).toContain("meet");
    const originalB = packedById(packDay(plan), "b");
    const previewB = packedById(packDay(preview.next), "b");
    expect(originalB?.derivedStartMs).not.toBe(previewB?.derivedStartMs);
  });

  it("changes derived times only on the previewed next plan, not from clock or unconfirmed apply", () => {
    const plan = twoChainPlan();
    const before = packDay(plan);
    dragFixedBody(plan, "meet", noon + HOUR, { confirmed: false });
    expect(packedById(packDay(plan), "meet")?.derivedStartMs).toBe(
      packedById(before, "meet")?.derivedStartMs,
    );
    const confirmed = editFixed(
      plan,
      "meet",
      { startMs: noon + HOUR, endMs: noon + 2 * HOUR },
      { confirmed: true },
    );
    expect(packedById(packDay(confirmed.next), "meet")?.derivedStartMs).toBe(
      noon + HOUR,
    );
  });
});

describe("drag preserves type; convertType is separate [D28]", () => {
  it("keeps fixed and flexible types under every drag", () => {
    const plan = twoChainPlan();
    const movedFixed = dragFixedBody(plan, "meet", noon - HOUR);
    expect(
      movedFixed.next.blocks.find((block) => block.id === "meet")?.type,
    ).toBe("fixed");
    const movedFlex = dragFlexibleBody(plan, "a", {
      precedingAnchorId: "meet",
      chainPosition: 1,
    });
    expect(movedFlex.next.blocks.find((block) => block.id === "a")?.type).toBe(
      "flexible",
    );
    const resized = dragEdge(plan, "b", { durationMs: 2 * HOUR });
    expect(resized.next.blocks.find((block) => block.id === "b")?.type).toBe(
      "flexible",
    );
  });

  it("converts type only through convertType", () => {
    const plan = twoChainPlan();
    const toFlex = convertType(plan, "meet", "flexible");
    const converted = toFlex.next.blocks.find((block) => block.id === "meet");
    expect(converted?.type).toBe("flexible");
    const back = convertType(toFlex.next, "meet", "fixed");
    expect(back.next.blocks.find((block) => block.id === "meet")?.type).toBe(
      "fixed",
    );
  });

  it("uses the same engine function for drag and non-drag move of a fixed block", () => {
    const plan = twoChainPlan();
    const dragged = dragFixedBody(plan, "meet", noon + HOUR, {
      confirmed: true,
    });
    const edited = editFixed(
      plan,
      "meet",
      { startMs: noon + HOUR, endMs: noon + 2 * HOUR },
      { confirmed: true },
    );
    const dragMeet = dragged.next.blocks.find((block) => block.id === "meet");
    const editMeet = edited.next.blocks.find((block) => block.id === "meet");
    expect(dragMeet).toEqual(editMeet);
  });
});

describe("unschedule [D6]", () => {
  it("removes the block from the day and does not complete or delete the task", () => {
    const { task } = createTask({
      id: "t-a",
      title: "Keep me",
      now: dayStart,
      source,
    });
    const plan = twoChainPlan();
    const preview = unschedule(plan, "a");
    expect(
      preview.next.blocks.find((block) => block.id === "a"),
    ).toBeUndefined();
    expect(task.status).toBe("Waiting");
    expect(task.title).toBe("Keep me");
    expect(task.id).toBe("t-a");
  });
});

describe("schedule and reserve [D22] [D29]", () => {
  it("creates a block of the type the caller chose, never inferred from the slot", () => {
    const empty = createDayPlan(DAY);
    const asFixed = scheduleTask(empty, {
      id: "n1",
      taskId: "t1",
      type: "fixed",
      startMs: noon,
      endMs: noon + HOUR,
    });
    expect(asFixed.next.blocks[0]?.type).toBe("fixed");
    const asFlex = scheduleTask(empty, {
      id: "n2",
      taskId: "t2",
      type: "flexible",
      durationMs: HOUR,
      precedingAnchorId: null,
      chainPosition: 0,
    });
    expect(asFlex.next.blocks[0]?.type).toBe("flexible");
  });

  it("creates a reserve with no task semantics", () => {
    const plan = createDayPlan(DAY);
    const preview = createReserve(plan, {
      id: "rest",
      type: "flexible",
      durationMs: HOUR,
      precedingAnchorId: null,
      chainPosition: 0,
    });
    const rest = preview.next.blocks[0];
    expect(rest && isReserveBlock(rest)).toBe(true);
    expect(rest).not.toHaveProperty("taskId");
    expect(rest).not.toHaveProperty("status");
    expect(rest).not.toHaveProperty("subtasks");
    expect(rest).not.toHaveProperty("repeatWeekdays");
    expect(rest).not.toHaveProperty("focusHistory");
    expect(rest).not.toHaveProperty("focusSession");
  });

  it("lets a fixed reserve act as a hard anchor", () => {
    const plan = createReserve(createDayPlan(DAY), {
      id: "lunch",
      type: "fixed",
      startMs: noon,
      endMs: noon + HOUR,
    }).next;
    const withWork = scheduleTask(plan, {
      id: "w",
      taskId: "t",
      type: "flexible",
      durationMs: HOUR,
      precedingAnchorId: "lunch",
      chainPosition: 0,
    });
    const packed = packDay(withWork.next);
    expect(packedById(packed, "w")?.derivedStartMs).toBe(noon + HOUR);
    const lunch = withWork.next.blocks.find((block) => block.id === "lunch");
    expect(lunch && isFixedBlock(lunch)).toBe(true);
  });
});

describe("conflict resolutions [D27]", () => {
  it("change duration, change order, move past anchor, unschedule, and keep conflict", () => {
    const plan = twoChainPlan();
    const duration = resolveConflict(plan, {
      resolution: "changeDuration",
      blockId: "a",
      durationMs: 2 * HOUR,
    });
    expect(
      duration.next.blocks.find((block) => block.id === "a")?.durationMs,
    ).toBe(2 * HOUR);

    const order = resolveConflict(plan, {
      resolution: "changeOrder",
      blockId: "b",
      chainPosition: 0,
    });
    const ordered = order.next.blocks.filter(isFlexibleBlock);
    const morning = ordered
      .filter((block) => block.precedingAnchorId === null)
      .sort((a, b) => a.chainPosition - b.chainPosition);
    expect(morning[0]?.id).toBe("b");

    const moved = resolveConflict(plan, {
      resolution: "moveBlockPastAnchor",
      blockId: "b",
    });
    const movedBlock = moved.next.blocks.find((block) => block.id === "b");
    expect(movedBlock && isFlexibleBlock(movedBlock)).toBe(true);
    if (movedBlock && isFlexibleBlock(movedBlock)) {
      expect(movedBlock.precedingAnchorId).toBe("meet");
    }

    const removed = resolveConflict(plan, {
      resolution: "unscheduleBlock",
      blockId: "b",
    });
    expect(
      removed.next.blocks.find((block) => block.id === "b"),
    ).toBeUndefined();

    const conflicting = scheduleTask(plan, {
      id: "long",
      taskId: "t-long",
      type: "flexible",
      durationMs: 20 * HOUR,
      precedingAnchorId: null,
      chainPosition: 2,
    });
    const kept = resolveConflict(conflicting.next, {
      resolution: "keepConflict",
    });
    expect(kept.next.blocks.some((block) => block.keptConflict)).toBe(true);
  });
});

describe("insertion does not move fixed anchors [D26]", () => {
  it("leaves existing fixed start and end unchanged when inserting work", () => {
    const plan = twoChainPlan();
    const meet = plan.blocks.find((block) => block.id === "meet");
    const inserted = scheduleTask(plan, {
      id: "extra",
      taskId: "t-extra",
      type: "flexible",
      durationMs: HOUR,
      precedingAnchorId: null,
      chainPosition: 0,
    });
    const still = inserted.next.blocks.find((block) => block.id === "meet");
    expect(still).toEqual(meet);
  });
});

describe("factory reserve has no taskId", () => {
  it("fixed reserve cannot carry a task reference", () => {
    const block = createFixedReserveBlock({
      id: "r",
      day: DAY,
      startMs: noon,
      endMs: noon + HOUR,
    });
    expect(block.kind).toBe("reserve");
    expect("taskId" in block).toBe(false);
  });
});
