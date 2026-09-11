import { addLocalDays, parseWorkieDayStart } from "../domain/workieDay";
import {
  type AnchorInterval,
  type CalendarBlock,
  type ChainId,
  type DayPlan,
  type FixedBlock,
  type FlexibleBlock,
  type PackedBlock,
  type PackedDay,
  chainKey,
  cloneBlock,
  isFixedBlock,
  isFlexibleBlock,
} from "./types";

function compareFixed(a: FixedBlock, b: FixedBlock): number {
  if (a.startMs !== b.startMs) {
    return a.startMs - b.startMs;
  }
  return a.id.localeCompare(b.id);
}

function compareFlexible(a: FlexibleBlock, b: FlexibleBlock): number {
  if (a.chainPosition !== b.chainPosition) {
    return a.chainPosition - b.chainPosition;
  }
  return a.id.localeCompare(b.id);
}

export function buildIntervals(
  fixed: readonly FixedBlock[],
  dayStartMs: number,
  dayEndMs: number,
): AnchorInterval[] {
  const anchors = [...fixed].sort(compareFixed);
  const first = anchors[0];
  const intervals: AnchorInterval[] = [
    {
      precedingAnchorId: null,
      startMs: dayStartMs,
      endMs: first?.startMs ?? dayEndMs,
      nextAnchorId: first?.id ?? null,
      nextAnchorStartMs: first?.startMs ?? null,
      nextAnchorEndMs: first?.endMs ?? null,
    },
  ];

  for (const [index, anchor] of anchors.entries()) {
    const following = anchors
      .slice(index + 1)
      .find((item) => item.startMs >= anchor.endMs);
    const startMs = anchor.endMs;
    const endMs = following?.startMs ?? dayEndMs;
    intervals.push({
      precedingAnchorId: anchor.id,
      startMs,
      endMs,
      nextAnchorId: following?.id ?? null,
      nextAnchorStartMs: following?.startMs ?? null,
      nextAnchorEndMs: following?.endMs ?? null,
    });
  }

  return intervals;
}

export function intervalForChain(
  intervals: readonly AnchorInterval[],
  precedingAnchorId: ChainId,
  dayStartMs: number,
  dayEndMs: number,
): AnchorInterval {
  const match = intervals.find(
    (item) => item.precedingAnchorId === precedingAnchorId,
  );
  if (match) {
    return match;
  }
  const dayStart = intervals.find((item) => item.precedingAnchorId === null);
  if (dayStart) {
    return dayStart;
  }
  return {
    precedingAnchorId: null,
    startMs: dayStartMs,
    endMs: dayEndMs,
    nextAnchorId: null,
    nextAnchorStartMs: null,
    nextAnchorEndMs: null,
  };
}

/**
 * Forward-packs each flexible chain from the preceding anchor or day edge.
 * Displayed times are derived. Clock time is not an input [D25].
 *
 * Overflow is not placed after the next hard anchor: a block that would
 * start at or after that anchor is parked at the anchor start [D27].
 */
export function packDay(plan: DayPlan): PackedDay {
  const dayStartMs = parseWorkieDayStart(plan.day);
  const dayEndMs = addLocalDays(dayStartMs, 1);
  const fixed = plan.blocks.filter(isFixedBlock);
  const intervals = buildIntervals(fixed, dayStartMs, dayEndMs);
  const packed: PackedBlock[] = [];

  for (const block of plan.blocks) {
    if (isFixedBlock(block)) {
      packed.push({
        ...cloneBlock(block),
        derivedStartMs: block.startMs,
        derivedEndMs: block.endMs,
      });
    }
  }

  const flexibles = plan.blocks.filter(isFlexibleBlock);
  const grouped = new Map<string, FlexibleBlock[]>();
  for (const block of flexibles) {
    const key = chainKey(block.precedingAnchorId);
    const group = grouped.get(key);
    if (group) {
      group.push(block);
    } else {
      grouped.set(key, [block]);
    }
  }

  for (const [key, group] of grouped) {
    const precedingAnchorId = key === "" ? null : key;
    const interval = intervalForChain(
      intervals,
      precedingAnchorId,
      dayStartMs,
      dayEndMs,
    );
    const delay = plan.chainStartDelayMs[key] ?? 0;
    const ordered = [...group].sort(compareFlexible);
    let cursor = interval.startMs + delay;
    const nextStart = interval.nextAnchorStartMs;

    for (const block of ordered) {
      let derivedStartMs = cursor;
      if (nextStart !== null && derivedStartMs >= nextStart) {
        derivedStartMs = nextStart;
      }
      packed.push({
        ...cloneBlock(block),
        derivedStartMs,
        derivedEndMs: derivedStartMs + block.durationMs,
      });
      cursor += block.durationMs;
    }
  }

  return {
    day: plan.day,
    dayStartMs,
    dayEndMs,
    blocks: packed,
    intervals,
  };
}

export function packedById(
  packed: PackedDay,
  blockId: string,
): PackedBlock | undefined {
  return packed.blocks.find((item) => item.id === blockId);
}

export function requirePacked(packed: PackedDay, blockId: string): PackedBlock {
  const block = packedById(packed, blockId);
  if (!block) {
    throw new Error(`Unknown block ${blockId}`);
  }
  return block;
}

export type LeftoverSpan = {
  precedingAnchorId: ChainId;
  startMs: number;
  endMs: number;
  nextAnchorId: string | null;
};

/**
 * Leftover in an interval sits immediately before the next anchor
 * (or the day edge) and is not scattered [D25].
 */
export function leftovers(packed: PackedDay): LeftoverSpan[] {
  const result: LeftoverSpan[] = [];
  for (const interval of packed.intervals) {
    if (interval.endMs <= interval.startMs) {
      continue;
    }
    const chain = packed.blocks
      .filter(
        (block): block is PackedBlock & FlexibleBlock =>
          isFlexibleBlock(block) &&
          block.precedingAnchorId === interval.precedingAnchorId,
      )
      .sort(compareFlexible);
    const last = chain[chain.length - 1];
    const startMs = last ? last.derivedEndMs : interval.startMs;
    if (startMs < interval.endMs) {
      result.push({
        precedingAnchorId: interval.precedingAnchorId,
        startMs,
        endMs: interval.endMs,
        nextAnchorId: interval.nextAnchorId,
      });
    }
  }
  return result;
}

export function derivedTimesById(
  packed: PackedDay,
): Map<string, { startMs: number; endMs: number }> {
  const map = new Map<string, { startMs: number; endMs: number }>();
  for (const block of packed.blocks) {
    map.set(block.id, {
      startMs: block.derivedStartMs,
      endMs: block.derivedEndMs,
    });
  }
  return map;
}

export function sameDerivedTimes(a: PackedDay, b: PackedDay): boolean {
  if (a.blocks.length !== b.blocks.length) {
    return false;
  }
  const other = derivedTimesById(b);
  for (const block of a.blocks) {
    const times = other.get(block.id);
    if (
      !times ||
      times.startMs !== block.derivedStartMs ||
      times.endMs !== block.derivedEndMs
    ) {
      return false;
    }
  }
  return true;
}

export function chainMembers(
  blocks: readonly CalendarBlock[],
  precedingAnchorId: ChainId,
): FlexibleBlock[] {
  return blocks
    .filter(
      (block): block is FlexibleBlock =>
        isFlexibleBlock(block) && block.precedingAnchorId === precedingAnchorId,
    )
    .sort(compareFlexible);
}
