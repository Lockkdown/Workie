import { packDay } from "./packing";
import {
  type CalendarBlock,
  type ChainId,
  type ConflictInfo,
  type DayPlan,
  type PackedBlock,
  type PackedDay,
  clonePlan,
  isFlexibleBlock,
} from "./types";

export type ChainCollision = {
  collidingBlockId: string;
  anchorId: string;
  affectedBlockIds: string[];
};

function overlapsNextAnchor(
  block: PackedBlock,
  nextStartMs: number,
  nextEndMs: number,
): boolean {
  return block.derivedStartMs < nextEndMs && block.derivedEndMs > nextStartMs;
}

export function detectChainCollisions(packed: PackedDay): ChainCollision[] {
  const collisions: ChainCollision[] = [];

  for (const interval of packed.intervals) {
    if (
      interval.nextAnchorId === null ||
      interval.nextAnchorStartMs === null ||
      interval.nextAnchorEndMs === null
    ) {
      continue;
    }
    const chain = packed.blocks
      .filter(
        (block): block is PackedBlock & { type: "flexible" } =>
          isFlexibleBlock(block) &&
          block.precedingAnchorId === interval.precedingAnchorId,
      )
      .sort(
        (a, b) => a.chainPosition - b.chainPosition || a.id.localeCompare(b.id),
      );

    let first = -1;
    for (const [index, block] of chain.entries()) {
      if (
        overlapsNextAnchor(
          block,
          interval.nextAnchorStartMs,
          interval.nextAnchorEndMs,
        ) ||
        block.derivedStartMs >= interval.nextAnchorStartMs
      ) {
        first = index;
        break;
      }
    }
    if (first < 0) {
      continue;
    }
    const colliding = chain[first];
    if (!colliding) {
      continue;
    }
    collisions.push({
      collidingBlockId: colliding.id,
      anchorId: interval.nextAnchorId,
      affectedBlockIds: chain.slice(first).map((item) => item.id),
    });
  }

  return collisions;
}

export function conflictInfos(packed: PackedDay): ConflictInfo[] {
  return detectChainCollisions(packed).map((item) => ({
    collidingBlockId: item.collidingBlockId,
    anchorId: item.anchorId,
    affectedBlockIds: item.affectedBlockIds,
  }));
}

export function stampCollisionMarks(
  plan: DayPlan,
  packed: PackedDay,
  options: { clearResolved: boolean },
): DayPlan {
  const collisions = detectChainCollisions(packed);
  const marked = new Set<string>();
  for (const collision of collisions) {
    for (const id of collision.affectedBlockIds) {
      marked.add(id);
    }
  }

  return {
    ...clonePlan(plan),
    blocks: plan.blocks.map((block) => {
      if (marked.has(block.id)) {
        return { ...block, conflict: true };
      }
      if (options.clearResolved) {
        return { ...block, conflict: false, keptConflict: false };
      }
      return block;
    }),
  };
}

export function chainsFromBlockIds(
  blocks: readonly CalendarBlock[],
  ids: readonly string[],
): ChainId[] {
  const wanted = new Set(ids);
  const chains = new Set<string | "null">();
  const result: ChainId[] = [];
  for (const block of blocks) {
    if (!wanted.has(block.id) || !isFlexibleBlock(block)) {
      continue;
    }
    const key =
      block.precedingAnchorId === null ? "null" : block.precedingAnchorId;
    if (chains.has(key)) {
      continue;
    }
    chains.add(key);
    result.push(block.precedingAnchorId);
  }
  return result;
}

export function affectedChainsBetween(
  before: DayPlan,
  after: DayPlan,
): ChainId[] {
  const beforePacked = packDay(before);
  const afterPacked = packDay(after);
  const beforeTimes = new Map(
    beforePacked.blocks.map((block) => [
      block.id,
      `${block.derivedStartMs}:${block.derivedEndMs}:${isFlexibleBlock(block) ? String(block.precedingAnchorId) : "fixed"}`,
    ]),
  );
  const seen = new Set<string | "null">();
  const result: ChainId[] = [];

  const consider = (chain: ChainId) => {
    const key = chain === null ? "null" : chain;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(chain);
  };

  for (const block of after.blocks) {
    if (!isFlexibleBlock(block)) {
      continue;
    }
    const previous = before.blocks.find((item) => item.id === block.id);
    const afterPackedBlock = afterPacked.blocks.find(
      (item) => item.id === block.id,
    );
    const signature = afterPackedBlock
      ? `${afterPackedBlock.derivedStartMs}:${afterPackedBlock.derivedEndMs}:${String(block.precedingAnchorId)}`
      : "";
    const changed =
      !previous ||
      !isFlexibleBlock(previous) ||
      previous.precedingAnchorId !== block.precedingAnchorId ||
      previous.chainPosition !== block.chainPosition ||
      previous.durationMs !== block.durationMs ||
      beforeTimes.get(block.id) !== signature;
    if (changed) {
      consider(block.precedingAnchorId);
      if (previous && isFlexibleBlock(previous)) {
        consider(previous.precedingAnchorId);
      }
    }
  }

  for (const block of before.blocks) {
    if (!isFlexibleBlock(block)) {
      continue;
    }
    if (!after.blocks.some((item) => item.id === block.id)) {
      consider(block.precedingAnchorId);
    }
  }

  return result;
}

export function finishPreview(
  original: DayPlan,
  next: DayPlan,
  confirmed: boolean,
  options: { clearResolved: boolean } = { clearResolved: true },
): {
  next: DayPlan;
  conflicts: ConflictInfo[];
  affectedChains: ChainId[];
  confirmed: boolean;
} {
  const packed = packDay(next);
  const stamped = stampCollisionMarks(next, packed, options);
  const stampedPacked = packDay(stamped);
  return {
    next: stamped,
    conflicts: conflictInfos(stampedPacked),
    affectedChains: affectedChainsBetween(original, stamped),
    confirmed,
  };
}
