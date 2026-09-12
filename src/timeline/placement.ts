import {
  type ChainId,
  type DayPlan,
  isFlexibleBlock,
  packDay,
} from "../calendar/index";
import { DEFAULT_DURATION_MS } from "./constants";
import { msFromAxisY } from "./format";

export function flexiblePlacementAt(
  plan: DayPlan,
  timeMs: number,
  excludeBlockId?: string,
): { precedingAnchorId: ChainId; chainPosition: number } {
  const packed = packDay(plan);
  const interval =
    [...packed.intervals].reverse().find((item) => timeMs >= item.startMs) ??
    packed.intervals[0];
  const precedingAnchorId = interval?.precedingAnchorId ?? null;
  const members = packed.blocks.filter(
    (block) =>
      isFlexibleBlock(block) &&
      block.precedingAnchorId === precedingAnchorId &&
      block.id !== excludeBlockId,
  );
  const chainPosition = members.filter(
    (block) => block.derivedStartMs <= timeMs,
  ).length;
  return { precedingAnchorId, chainPosition };
}

export function slotFromAxisY(
  plan: DayPlan,
  y: number,
  excludeBlockId?: string,
): {
  startMs: number;
  durationMs: number;
  precedingAnchorId: ChainId;
  chainPosition: number;
} {
  const packed = packDay(plan);
  const startMs = msFromAxisY(y, packed.dayStartMs);
  const place = flexiblePlacementAt(plan, startMs, excludeBlockId);
  return {
    startMs,
    durationMs: DEFAULT_DURATION_MS,
    precedingAnchorId: place.precedingAnchorId,
    chainPosition: place.chainPosition,
  };
}
