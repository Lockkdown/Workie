import { leftovers, packDay } from "./packing";
import {
  type ChainId,
  type DayPlan,
  type FlexibleBlock,
  type PackedDay,
  isFixedBlock,
  isFlexibleBlock,
} from "./types";

export type OverloadIssue =
  | {
      kind: "overlappingFixed";
      blockIds: [string, string];
      span: { startMs: number; endMs: number };
    }
  | {
      kind: "chainExceedsCapacity";
      precedingAnchorId: ChainId;
      blockIds: string[];
      span: { startMs: number; endMs: number };
      chainDurationMs: number;
      capacityMs: number;
    }
  | {
      kind: "unresolvedConflict";
      blockIds: string[];
    };

export type OverloadReport = {
  overloaded: boolean;
  issues: OverloadIssue[];
};

function overlapMs(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function overlappingFixedIssues(plan: DayPlan): OverloadIssue[] {
  const issues: OverloadIssue[] = [];
  const fixed = plan.blocks.filter(isFixedBlock);
  for (let i = 0; i < fixed.length; i += 1) {
    const a = fixed[i];
    if (!a) {
      continue;
    }
    for (let j = i + 1; j < fixed.length; j += 1) {
      const b = fixed[j];
      if (!b) {
        continue;
      }
      if (a.startMs < b.endMs && a.endMs > b.startMs) {
        issues.push({
          kind: "overlappingFixed",
          blockIds: [a.id, b.id],
          span: {
            startMs: Math.max(a.startMs, b.startMs),
            endMs: Math.min(a.endMs, b.endMs),
          },
        });
      }
    }
  }
  return issues;
}

function capacityMs(packed: PackedDay, intervalIndex: number): number {
  const interval = packed.intervals[intervalIndex];
  if (!interval || interval.endMs <= interval.startMs) {
    return 0;
  }
  const length = interval.endMs - interval.startMs;
  let occupancy = 0;
  for (const block of packed.blocks) {
    if (!isFixedBlock(block)) {
      continue;
    }
    occupancy += overlapMs(
      interval.startMs,
      interval.endMs,
      block.startMs,
      block.endMs,
    );
  }
  return Math.max(0, length - occupancy);
}

function chainExceedsIssues(plan: DayPlan, packed: PackedDay): OverloadIssue[] {
  const issues: OverloadIssue[] = [];
  for (const [index, interval] of packed.intervals.entries()) {
    if (interval.endMs <= interval.startMs) {
      continue;
    }
    const chain = plan.blocks.filter(
      (block): block is FlexibleBlock =>
        isFlexibleBlock(block) &&
        block.precedingAnchorId === interval.precedingAnchorId,
    );
    if (chain.length === 0) {
      continue;
    }
    const chainDurationMs = chain.reduce(
      (sum, block) => sum + block.durationMs,
      0,
    );
    const capacity = capacityMs(packed, index);
    if (chainDurationMs > capacity) {
      issues.push({
        kind: "chainExceedsCapacity",
        precedingAnchorId: interval.precedingAnchorId,
        blockIds: [...chain]
          .sort((a, b) => a.chainPosition - b.chainPosition)
          .map((block) => block.id),
        span: { startMs: interval.startMs, endMs: interval.endMs },
        chainDurationMs,
        capacityMs: capacity,
      });
    }
  }
  return issues;
}

function unresolvedConflictIssues(plan: DayPlan): OverloadIssue[] {
  const blockIds = plan.blocks
    .filter((block) => block.conflict)
    .map((block) => block.id);
  if (blockIds.length === 0) {
    return [];
  }
  return [{ kind: "unresolvedConflict", blockIds }];
}

/**
 * Overload is true iff any of the three [D30] conditions hold.
 * Task count, priority and difficulty are not inputs.
 */
export function evaluateOverload(plan: DayPlan): OverloadReport {
  const packed = packDay(plan);
  const issues = [
    ...overlappingFixedIssues(plan),
    ...chainExceedsIssues(plan, packed),
    ...unresolvedConflictIssues(plan),
  ];
  return {
    overloaded: issues.length > 0,
    issues,
  };
}

export function leftoverBeforeNextAnchor(
  plan: DayPlan,
): ReturnType<typeof leftovers> {
  return leftovers(packDay(plan));
}
