import { writeTaskDrag, type TaskDragPayload } from "../desk/taskDrag";
import type { StatusEntityKind } from "../domain/types";

export const BOARD_CARD_DRAG = "application/x-workie-board-card";

export type BoardCardDragPayload = {
  entityId: string;
  kind: StatusEntityKind;
  taskId: string;
};

export function serializeBoardCardDrag(payload: BoardCardDragPayload): string {
  return JSON.stringify(payload);
}

export function parseBoardCardDrag(
  raw: string | null | undefined,
): BoardCardDragPayload | null {
  if (raw === null || raw === undefined || raw.length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "entityId" in parsed &&
      "kind" in parsed &&
      "taskId" in parsed &&
      typeof parsed.entityId === "string" &&
      parsed.entityId.length > 0 &&
      typeof parsed.taskId === "string" &&
      parsed.taskId.length > 0 &&
      (parsed.kind === "task" || parsed.kind === "occurrence")
    ) {
      return {
        entityId: parsed.entityId,
        kind: parsed.kind,
        taskId: parsed.taskId,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Calendar payload stays `{ taskId }` for T7; board payload carries the entity. */
export function writeBoardCardDrag(
  transfer: DataTransfer,
  payload: BoardCardDragPayload,
): void {
  transfer.setData(BOARD_CARD_DRAG, serializeBoardCardDrag(payload));
  writeTaskDrag(transfer, { taskId: payload.taskId } satisfies TaskDragPayload);
}

export function readBoardCardDrag(
  transfer: DataTransfer | null,
): BoardCardDragPayload | null {
  if (transfer === null) {
    return null;
  }
  return parseBoardCardDrag(transfer.getData(BOARD_CARD_DRAG));
}
