/** HTML5 drag payload for an unscheduled task onto the day timeline [D6] [D14]. */
export const WORKIE_TASK_DRAG = "application/x-workie-task";

export type TaskDragPayload = {
  taskId: string;
};

export function serializeTaskDrag(payload: TaskDragPayload): string {
  return JSON.stringify(payload);
}

export function parseTaskDrag(
  raw: string | null | undefined,
): TaskDragPayload | null {
  if (raw === null || raw === undefined || raw.length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "taskId" in parsed &&
      typeof parsed.taskId === "string" &&
      parsed.taskId.length > 0
    ) {
      return { taskId: parsed.taskId };
    }
  } catch {
    return null;
  }
  return null;
}

export function readTaskDrag(
  transfer: DataTransfer | null,
): TaskDragPayload | null {
  if (transfer === null) {
    return null;
  }
  return parseTaskDrag(transfer.getData(WORKIE_TASK_DRAG));
}

export function writeTaskDrag(
  transfer: DataTransfer,
  payload: TaskDragPayload,
): void {
  const raw = serializeTaskDrag(payload);
  transfer.setData(WORKIE_TASK_DRAG, raw);
  transfer.setData("text/plain", payload.taskId);
  transfer.effectAllowed = "copy";
}
