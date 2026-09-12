import { describe, expect, it } from "vitest";
import {
  createDayPlan,
  createFixedTaskBlock,
  evaluateOverload,
} from "../calendar/index";
import { createOccurrence, createTask } from "../domain/taskModel";
import { tomorrowWorkieDay, workieDayKey } from "../domain/workieDay";
import {
  applyRevision,
  commitDocument,
  emptyDocument,
  isCommitment,
  mayCommit,
  markKeepAnyway,
  needsKeepAnyway,
  placeFixed,
  placeFlexible,
  placedBlocksForCommit,
  setStep,
  toggleSelected,
} from "./ritual";
import { namedReviewIssues } from "./review";
import { buildTray, trayGroupOrder } from "./tray";
import type { TrayItem } from "./types";

const source = { kind: "user" as const, accountId: "local" };
const NOW = new Date(2026, 8, 14, 20, 0, 0, 0).getTime();
const TODAY = workieDayKey(NOW);
const TOMORROW = tomorrowWorkieDay(NOW);

function task(
  id: string,
  title: string,
  extra: Partial<ReturnType<typeof createTask>["task"]> = {},
) {
  return { ...createTask({ id, title, now: NOW, source }).task, ...extra };
}

describe("suggestion tray [D18] [D24]", () => {
  it("uses exactly three groups in locked order and selects nothing", () => {
    expect([...trayGroupOrder()]).toEqual([
      "Unfinished today",
      "Repeating tomorrow",
      "Live tasks",
    ]);
    const live = task("live", "Inbox");
    const groups = buildTray({
      now: NOW,
      tasks: [live],
      occurrences: [],
      todayPlan: createDayPlan(TODAY),
    });
    expect(groups["Live tasks"][0]?.id).toBe("live");
    expect(groups["Live tasks"][0]?.reason).toContain("Live");
  });

  it("keeps Kanban order inside a group", () => {
    const waiting = task("w", "W", { status: "Waiting", liveOrder: 2 });
    const progress = task("p", "P", { status: "In Progress", liveOrder: 1 });
    const groups = buildTray({
      now: NOW,
      tasks: [progress, waiting],
      occurrences: [],
      todayPlan: createDayPlan(TODAY),
    });
    expect(groups["Live tasks"].map((item) => item.id)).toEqual(["w", "p"]);
  });

  it("puts Deferred in Live tasks and does not auto-promote it", () => {
    const deferred = task("d", "Later", { status: "Deferred" });
    const groups = buildTray({
      now: NOW,
      tasks: [deferred],
      occurrences: [],
      todayPlan: createDayPlan(TODAY, [
        createFixedTaskBlock({
          id: "b1",
          taskId: "d",
          day: TODAY,
          startMs: NOW,
          endMs: NOW + 30 * 60_000,
        }),
      ]),
    });
    expect(groups["Unfinished today"]).toHaveLength(0);
    expect(groups["Live tasks"][0]?.reason).toMatch(/Deferred/);
  });

  it("lists missed occurrences separately with their dates", () => {
    const series = task("rep", "Repeat", {
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const missed = createOccurrence({
      id: "occ-miss",
      taskId: "rep",
      date: "2026-09-13",
      now: NOW,
    }).occurrence;
    const groups = buildTray({
      now: NOW,
      tasks: [series],
      occurrences: [missed],
      todayPlan: createDayPlan(TODAY),
    });
    expect(groups["Unfinished today"][0]?.date).toBe("2026-09-13");
    expect(groups["Unfinished today"][0]?.reason).toContain("2026-09-13");
  });

  it("shows tomorrow occurrences in Repeating tomorrow with a date", () => {
    const series = task("rep", "Repeat", {
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const tomorrowOcc = createOccurrence({
      id: "occ-tom",
      taskId: "rep",
      date: TOMORROW,
      now: NOW,
    }).occurrence;
    const groups = buildTray({
      now: NOW,
      tasks: [series],
      occurrences: [tomorrowOcc],
      todayPlan: createDayPlan(TODAY),
    });
    expect(groups["Repeating tomorrow"][0]?.date).toBe(TOMORROW);
    expect(groups["Repeating tomorrow"][0]?.reason).toContain(TOMORROW);
  });
});

describe("ritual [D19] [D21] [D23]", () => {
  const item: TrayItem = {
    id: "live",
    entityKind: "task",
    taskId: "live",
    title: "Inbox",
    date: null,
    status: "Waiting",
    liveOrder: 0,
    group: "Live tasks",
    reason: "Live task",
  };

  it("has three steps and selection without a block is not a commitment", () => {
    let doc = emptyDocument(TOMORROW, NOW);
    doc = toggleSelected(doc, "live", NOW);
    doc = setStep(doc, 2, NOW);
    expect(doc.step).toBe(2);
    expect(isCommitment(doc, "live")).toBe(false);
    expect(placedBlocksForCommit(doc).blocks).toHaveLength(0);
  });

  it("places a flexible block by duration and chain position, not a start time", () => {
    const doc = toggleSelected(emptyDocument(TOMORROW, NOW), "live", NOW);
    const placed = placeFlexible({
      doc,
      item,
      blockId: "flex-1",
      durationMs: 30 * 60_000,
      precedingAnchorId: null,
      chainPosition: 0,
      now: NOW,
    });
    const block = placed.doc.plan.blocks[0];
    expect(block?.type).toBe("flexible");
    if (block?.type === "flexible") {
      expect(block.chainPosition).toBe(0);
      expect(block.durationMs).toBe(30 * 60_000);
      expect("startMs" in block).toBe(false);
    }
    expect(isCommitment(placed.doc, "live")).toBe(true);
  });

  it("commits only through Commit Tomorrow and then stays committed on revision", () => {
    let doc = toggleSelected(emptyDocument(TOMORROW, NOW), "live", NOW);
    doc = placeFixed({
      doc,
      item,
      blockId: "fix-1",
      startHour: 9,
      startMinute: 0,
      durationMs: 30 * 60_000,
      now: NOW,
    }).doc;
    expect(doc.commitState).toBe("draft");
    doc = commitDocument(doc, NOW + 1);
    expect(doc.commitState).toBe("committed");
    doc = applyRevision(doc, doc.plan, "rev-1", NOW + 2);
    expect(doc.commitState).toBe("committed");
    expect(doc.revisions).toHaveLength(1);
  });

  it("Keep Anyway is required when review has a problem, and never re-levels", () => {
    let doc = toggleSelected(emptyDocument(TOMORROW, NOW), "live", NOW);
    doc = placeFixed({
      doc,
      item,
      blockId: "a",
      startHour: 9,
      startMinute: 0,
      durationMs: 60 * 60_000,
      now: NOW,
    }).doc;
    const other: TrayItem = { ...item, id: "live-2", taskId: "live-2" };
    doc = toggleSelected(doc, "live-2", NOW);
    doc = placeFixed({
      doc,
      item: other,
      blockId: "b",
      startHour: 9,
      startMinute: 0,
      durationMs: 60 * 60_000,
      now: NOW,
    }).doc;
    expect(needsKeepAnyway(doc)).toBe(true);
    expect(mayCommit(doc)).toBe(false);
    const before = doc.plan.blocks.map((block) => block.id);
    doc = markKeepAnyway(doc, NOW);
    expect(mayCommit(doc)).toBe(true);
    expect(doc.plan.blocks.map((block) => block.id)).toEqual(before);
    expect(namedReviewIssues(doc.plan).length).toBeGreaterThan(0);
    expect(evaluateOverload(doc.plan).overloaded).toBe(true);
  });
});
