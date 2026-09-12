import { WORKIE_BLOCK_DRAG } from "./constants";

export type BlockDragPayload = {
  blockId: string;
};

export function serializeBlockDrag(payload: BlockDragPayload): string {
  return JSON.stringify(payload);
}

export function parseBlockDrag(
  raw: string | null | undefined,
): BlockDragPayload | null {
  if (raw === null || raw === undefined || raw.length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "blockId" in parsed &&
      typeof parsed.blockId === "string" &&
      parsed.blockId.length > 0
    ) {
      return { blockId: parsed.blockId };
    }
  } catch {
    return null;
  }
  return null;
}

export function readBlockDrag(
  transfer: DataTransfer | null,
): BlockDragPayload | null {
  if (transfer === null) {
    return null;
  }
  return (
    parseBlockDrag(transfer.getData(WORKIE_BLOCK_DRAG)) ??
    parseBlockDrag(transfer.getData("text/plain"))
  );
}

export function writeBlockDrag(
  transfer: DataTransfer,
  payload: BlockDragPayload,
): void {
  const raw = serializeBlockDrag(payload);
  transfer.setData(WORKIE_BLOCK_DRAG, raw);
  transfer.setData("text/plain", raw);
  transfer.effectAllowed = "move";
}
