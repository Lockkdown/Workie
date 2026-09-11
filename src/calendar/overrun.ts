import { conflictInfos, finishPreview, stampCollisionMarks } from "./conflict";
import { packDay, requirePacked } from "./packing";
import {
  type DayPlan,
  type MutationPreview,
  type PackedBlock,
  FIVE_MINUTES_MS,
  chainKey,
  clonePlan,
  isFixedBlock,
  isFlexibleBlock,
} from "./types";

/**
 * True when the block has started and at most five minutes remain before
 * its (derived or absolute) end [D1].
 */
export function warnBeforeEnd(block: PackedBlock, now: number): boolean {
  if (now < block.derivedStartMs) {
    return false;
  }
  const remaining = block.derivedEndMs - now;
  return remaining > 0 && remaining <= FIVE_MINUTES_MS;
}

export function warnBeforeEndOfRunning(plan: DayPlan, now: number): boolean {
  if (plan.runningBlockId === null) {
    return false;
  }
  const packed = packDay(plan);
  const running = packed.blocks.find((item) => item.id === plan.runningBlockId);
  if (!running) {
    return false;
  }
  return warnBeforeEnd(running, now);
}

/**
 * Pushes later blocks up to the first hard anchor and no further [D1][D27].
 * Applies none of the five resolutions. Never moves a fixed start or end [D26].
 */
export function applyOverrunPush(plan: DayPlan, now: number): MutationPreview {
  const runningId = plan.runningBlockId;
  if (runningId === null) {
    return finishPreview(plan, clonePlan(plan), true, { clearResolved: false });
  }
  const packed = packDay(plan);
  const running = packed.blocks.find((item) => item.id === runningId);
  if (!running || now <= running.derivedEndMs) {
    return finishPreview(plan, clonePlan(plan), true, { clearResolved: false });
  }

  const overrunMs = now - running.derivedEndMs;
  let next = clonePlan(plan);

  if (isFlexibleBlock(running)) {
    next = {
      ...next,
      blocks: next.blocks.map((block) =>
        block.id === runningId && isFlexibleBlock(block)
          ? { ...block, durationMs: block.durationMs + overrunMs }
          : block,
      ),
    };
  } else if (isFixedBlock(running)) {
    const key = chainKey(running.id);
    next = {
      ...next,
      chainStartDelayMs: {
        ...next.chainStartDelayMs,
        [key]: overrunMs,
      },
    };
  }

  const packedNext = packDay(next);
  const stamped = stampCollisionMarks(next, packedNext, {
    clearResolved: false,
  });
  const originalFixed = new Map(
    plan.blocks.filter(isFixedBlock).map((block) => [block.id, block]),
  );
  for (const block of stamped.blocks) {
    if (!isFixedBlock(block)) {
      continue;
    }
    const before = originalFixed.get(block.id);
    if (
      before &&
      (before.startMs !== block.startMs || before.endMs !== block.endMs)
    ) {
      throw new Error("Overrun must not move a fixed block [D26]");
    }
  }

  return {
    next: stamped,
    conflicts: conflictInfos(packDay(stamped)),
    affectedChains: finishPreview(plan, stamped, true, { clearResolved: false })
      .affectedChains,
    confirmed: true,
  };
}

export function packedRunningBlock(plan: DayPlan): PackedBlock | undefined {
  if (plan.runningBlockId === null) {
    return undefined;
  }
  return requirePacked(packDay(plan), plan.runningBlockId);
}
