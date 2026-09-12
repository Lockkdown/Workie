import { describe, expect, it } from "vitest";
import { parseTaskDrag, serializeTaskDrag, WORKIE_TASK_DRAG } from "./taskDrag";

describe("task drag payload", () => {
  it("round-trips a task id", () => {
    const raw = serializeTaskDrag({ taskId: "task-1" });
    expect(parseTaskDrag(raw)).toEqual({ taskId: "task-1" });
  });

  it("rejects empty or malformed payloads", () => {
    expect(parseTaskDrag(null)).toBeNull();
    expect(parseTaskDrag("")).toBeNull();
    expect(parseTaskDrag("{}")).toBeNull();
    expect(parseTaskDrag('{"taskId":""}')).toBeNull();
  });

  it("keeps the MIME type stable for T5 and T7", () => {
    expect(WORKIE_TASK_DRAG).toBe("application/x-workie-task");
  });
});
