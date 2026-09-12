import { describe, expect, it } from "vitest";
import { parseTaskDrag, WORKIE_TASK_DRAG } from "../desk/taskDrag";
import {
  BOARD_CARD_DRAG,
  parseBoardCardDrag,
  writeBoardCardDrag,
} from "./boardDrag";

class FakeTransfer {
  effectAllowed = "none";
  private readonly data = new Map<string, string>();

  setData(type: string, value: string): void {
    this.data.set(type, value);
  }

  getData(type: string): string {
    return this.data.get(type) ?? "";
  }
}

describe("board card drag [D6] [D14]", () => {
  it("writes writeTaskDrag payload without a final outcome", () => {
    const transfer = new FakeTransfer();
    writeBoardCardDrag(transfer as unknown as DataTransfer, {
      entityId: "occ-1",
      kind: "occurrence",
      taskId: "parent-1",
    });
    expect(parseTaskDrag(transfer.getData(WORKIE_TASK_DRAG))).toEqual({
      taskId: "parent-1",
    });
    expect(parseBoardCardDrag(transfer.getData(BOARD_CARD_DRAG))).toEqual({
      entityId: "occ-1",
      kind: "occurrence",
      taskId: "parent-1",
    });
    expect(transfer.effectAllowed).toBe("copy");
  });
});
