import { describe, expect, it } from "vitest";
import {
  CLOSED_STATUSES,
  CLOSED_SUBGROUPS,
  closedSubgroup,
  isClosedStatus,
  isLiveStatus,
  isTaskStatus,
  kanbanColumn,
  KANBAN_COLUMNS,
  LIVE_STATUSES,
  TASK_STATUSES,
  UNFINISHED_OUTCOMES,
  type Task,
} from "./types";

describe("task statuses [D11] [D86] [D7]", () => {
  it("exposes exactly the six canonical names", () => {
    expect([...TASK_STATUSES]).toEqual([
      "Waiting",
      "In Progress",
      "Deferred",
      "Completed",
      "Abandoned",
      "Cancelled",
    ]);
    expect(new Set(TASK_STATUSES).size).toBe(6);
  });

  it("keeps the three unfinished outcomes distinct", () => {
    expect([...UNFINISHED_OUTCOMES]).toEqual([
      "Deferred",
      "Abandoned",
      "Cancelled",
    ]);
    expect(new Set(UNFINISHED_OUTCOMES).size).toBe(3);
    expect(UNFINISHED_OUTCOMES).not.toContain("Failed");
    expect(UNFINISHED_OUTCOMES).not.toContain("Missed");
  });

  it("does not include Scheduled, Missed, or a merged failure status", () => {
    expect(isTaskStatus("Scheduled")).toBe(false);
    expect(isTaskStatus("Missed")).toBe(false);
    expect(isTaskStatus("Failed")).toBe(false);
    expect(TASK_STATUSES).not.toContain("Scheduled");
  });

  it("maps six statuses onto four columns with three Closed subgroups [D11]", () => {
    expect([...KANBAN_COLUMNS]).toEqual([
      "Waiting",
      "In Progress",
      "Deferred",
      "Closed",
    ]);
    expect(kanbanColumn("Waiting")).toBe("Waiting");
    expect(kanbanColumn("In Progress")).toBe("In Progress");
    expect(kanbanColumn("Deferred")).toBe("Deferred");
    expect(kanbanColumn("Completed")).toBe("Closed");
    expect(kanbanColumn("Abandoned")).toBe("Closed");
    expect(kanbanColumn("Cancelled")).toBe("Closed");
    expect([...CLOSED_SUBGROUPS]).toEqual([...CLOSED_STATUSES]);
    expect(closedSubgroup("Completed")).toBe("Completed");
    expect(closedSubgroup("Waiting")).toBeUndefined();
  });

  it("classifies live vs closed", () => {
    expect(LIVE_STATUSES.every(isLiveStatus)).toBe(true);
    expect(CLOSED_STATUSES.every(isClosedStatus)).toBe(true);
    expect(isLiveStatus("Completed")).toBe(false);
    expect(isClosedStatus("Waiting")).toBe(false);
  });

  it("does not put category on the Task type [D64]", () => {
    type Forbidden = Extract<
      keyof Task,
      "category" | "project" | "assignee" | "tags" | "folders" | "outcome"
    >;
    const forbidden: Forbidden extends never ? true : never = true;
    expect(forbidden).toBe(true);
  });
});
