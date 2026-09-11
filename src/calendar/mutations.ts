import { workieDayKey } from "../domain/workieDay";
import { finishPreview } from "./conflict";
import { packDay, requirePacked } from "./packing";
import {
  type CalendarBlock,
  type ChainId,
  type ConfirmOptions,
  type DayPlan,
  type FlexibleBlock,
  type MutationPreview,
  type ResolveConflictParams,
  cloneBlock,
  clonePlan,
  createFixedReserveBlock,
  createFixedTaskBlock,
  createFlexibleReserveBlock,
  createFlexibleTaskBlock,
  isFixedBlock,
  isFlexibleBlock,
  requireBlock,
} from "./types";

function confirmedOf(options?: Partial<ConfirmOptions>): boolean {
  return options?.confirmed !== false;
}

function reindexChain(
  blocks: readonly CalendarBlock[],
  precedingAnchorId: ChainId,
): CalendarBlock[] {
  const ordered = blocks
    .filter(
      (block): block is FlexibleBlock =>
        isFlexibleBlock(block) && block.precedingAnchorId === precedingAnchorId,
    )
    .sort(
      (a, b) => a.chainPosition - b.chainPosition || a.id.localeCompare(b.id),
    );
  const positions = new Map(ordered.map((block, index) => [block.id, index]));
  return blocks.map((block) => {
    const position = positions.get(block.id);
    if (position === undefined || !isFlexibleBlock(block)) {
      return cloneBlock(block);
    }
    return { ...block, chainPosition: position };
  });
}

function bumpPositions(
  blocks: readonly CalendarBlock[],
  precedingAnchorId: ChainId,
  at: number,
): CalendarBlock[] {
  return blocks.map((block) => {
    if (
      isFlexibleBlock(block) &&
      block.precedingAnchorId === precedingAnchorId &&
      block.chainPosition >= at
    ) {
      return { ...block, chainPosition: block.chainPosition + 1 };
    }
    return cloneBlock(block);
  });
}

function previousRemainingAnchorId(plan: DayPlan, removedId: string): ChainId {
  const removed = plan.blocks.find(
    (block) => block.id === removedId && isFixedBlock(block),
  );
  if (!removed || !isFixedBlock(removed)) {
    return null;
  }
  const remaining = plan.blocks
    .filter(
      (block): block is Extract<CalendarBlock, { type: "fixed" }> =>
        isFixedBlock(block) && block.id !== removedId,
    )
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  let previous: ChainId = null;
  for (const block of remaining) {
    if (block.startMs < removed.startMs) {
      previous = block.id;
    }
  }
  return previous;
}

function rehomeOrphans(plan: DayPlan, removedFixedId: string): DayPlan {
  const destination = previousRemainingAnchorId(plan, removedFixedId);
  const destMembers = plan.blocks.filter(
    (block) =>
      isFlexibleBlock(block) && block.precedingAnchorId === destination,
  );
  let nextPosition = destMembers.length;
  const blocks = plan.blocks.map((block) => {
    if (isFlexibleBlock(block) && block.precedingAnchorId === removedFixedId) {
      const moved = {
        ...block,
        precedingAnchorId: destination,
        chainPosition: nextPosition,
      };
      nextPosition += 1;
      return moved;
    }
    return cloneBlock(block);
  });
  const delay = { ...plan.chainStartDelayMs };
  delete delay[removedFixedId];
  const next: DayPlan = {
    ...plan,
    blocks: reindexChain(blocks, destination),
    chainStartDelayMs: delay,
  };
  return next;
}

function dropBlock(plan: DayPlan, blockId: string): DayPlan {
  const block = requireBlock(plan, blockId);
  let next: DayPlan = {
    ...clonePlan(plan),
    blocks: plan.blocks.filter((item) => item.id !== blockId).map(cloneBlock),
    runningBlockId:
      plan.runningBlockId === blockId ? null : plan.runningBlockId,
  };
  if (isFixedBlock(block)) {
    next = rehomeOrphans(next, blockId);
  } else if (isFlexibleBlock(block)) {
    next = {
      ...next,
      blocks: reindexChain(next.blocks, block.precedingAnchorId),
    };
  }
  return next;
}

/**
 * Deliberate edit of a hard anchor. Automatic paths must never call this [D26].
 */
export function editFixed(
  plan: DayPlan,
  blockId: string,
  times: { startMs: number; endMs: number },
  options: ConfirmOptions,
): MutationPreview {
  const block = requireBlock(plan, blockId);
  if (!isFixedBlock(block)) {
    throw new Error("editFixed applies only to fixed blocks [D26]");
  }
  const durationMs = times.endMs - times.startMs;
  if (durationMs <= 0) {
    throw new Error("Fixed block end must be after start [D21]");
  }
  const nextBlock = {
    ...block,
    startMs: times.startMs,
    endMs: times.endMs,
    durationMs,
    day: workieDayKey(times.startMs),
  };
  const next = {
    ...clonePlan(plan),
    blocks: plan.blocks.map((item) =>
      item.id === blockId ? nextBlock : cloneBlock(item),
    ),
  };
  return finishPreview(plan, next, options.confirmed);
}

/** Drag body of a fixed block: duration preserved [D28]. */
export function dragFixedBody(
  plan: DayPlan,
  blockId: string,
  newStartMs: number,
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  const block = requireBlock(plan, blockId);
  if (!isFixedBlock(block)) {
    throw new Error("dragFixedBody applies only to fixed blocks [D28]");
  }
  return editFixed(
    plan,
    blockId,
    { startMs: newStartMs, endMs: newStartMs + block.durationMs },
    { confirmed: confirmedOf(options) },
  );
}

/** Drag body of a flexible block: order or chain membership [D28]. */
export function dragFlexibleBody(
  plan: DayPlan,
  blockId: string,
  target: { precedingAnchorId: ChainId; chainPosition: number },
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  const block = requireBlock(plan, blockId);
  if (!isFlexibleBlock(block)) {
    throw new Error("dragFlexibleBody applies only to flexible blocks [D28]");
  }
  const removed = dropBlock(plan, blockId);
  const bumped = bumpPositions(
    removed.blocks,
    target.precedingAnchorId,
    target.chainPosition,
  );
  const placed: FlexibleBlock = {
    ...block,
    precedingAnchorId: target.precedingAnchorId,
    chainPosition: target.chainPosition,
  };
  const next: DayPlan = {
    ...removed,
    blocks: reindexChain(
      reindexChain([...bumped, placed], block.precedingAnchorId),
      target.precedingAnchorId,
    ),
  };
  return finishPreview(plan, next, confirmedOf(options));
}

export function dragEdge(
  plan: DayPlan,
  blockId: string,
  change:
    | { edge: "start"; timeMs: number }
    | { edge: "end"; timeMs: number }
    | { durationMs: number },
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  const block = requireBlock(plan, blockId);
  if (isFixedBlock(block)) {
    let startMs = block.startMs;
    let endMs = block.endMs;
    if ("durationMs" in change) {
      endMs = startMs + change.durationMs;
    } else if (change.edge === "start") {
      startMs = change.timeMs;
    } else {
      endMs = change.timeMs;
    }
    return editFixed(
      plan,
      blockId,
      { startMs, endMs },
      {
        confirmed: confirmedOf(options),
      },
    );
  }
  const packedBlock = requirePacked(packDay(plan), blockId);
  const durationMs =
    "durationMs" in change
      ? change.durationMs
      : change.edge === "end"
        ? change.timeMs - packedBlock.derivedStartMs
        : packedBlock.derivedEndMs - change.timeMs;
  if (durationMs <= 0) {
    throw new Error("Block duration must be positive [D21]");
  }
  const next = {
    ...clonePlan(plan),
    blocks: plan.blocks.map((item) =>
      item.id === blockId && isFlexibleBlock(item)
        ? { ...item, durationMs }
        : cloneBlock(item),
    ),
  };
  return finishPreview(plan, next, confirmedOf(options));
}

/**
 * Convert type is a separate explicit operation. Drags never call this [D28].
 */
export function convertType(
  plan: DayPlan,
  blockId: string,
  to: "fixed" | "flexible",
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  const block = requireBlock(plan, blockId);
  if (block.type === to) {
    return finishPreview(plan, clonePlan(plan), confirmedOf(options));
  }
  if (to === "flexible" && isFixedBlock(block)) {
    const without = dropBlock(plan, blockId);
    const packed = packDay(without);
    const interval =
      packed.intervals.find(
        (item) => block.startMs >= item.startMs && block.startMs < item.endMs,
      ) ?? packed.intervals[0];
    const precedingAnchorId = interval?.precedingAnchorId ?? null;
    const chainPosition = without.blocks.filter(
      (item) =>
        isFlexibleBlock(item) && item.precedingAnchorId === precedingAnchorId,
    ).length;
    const converted =
      block.kind === "task"
        ? createFlexibleTaskBlock({
            id: block.id,
            taskId: block.taskId,
            day: plan.day,
            durationMs: block.durationMs,
            chainPosition,
            precedingAnchorId,
          })
        : createFlexibleReserveBlock({
            id: block.id,
            day: plan.day,
            durationMs: block.durationMs,
            chainPosition,
            precedingAnchorId,
          });
    const next: DayPlan = {
      ...without,
      blocks: [...without.blocks, converted],
    };
    return finishPreview(plan, next, confirmedOf(options));
  }

  const packed = packDay(plan);
  const derived = requirePacked(packed, blockId);
  const without = dropBlock(plan, blockId);
  const converted =
    block.kind === "task"
      ? createFixedTaskBlock({
          id: block.id,
          taskId: block.taskId,
          day: plan.day,
          startMs: derived.derivedStartMs,
          endMs: derived.derivedEndMs,
        })
      : createFixedReserveBlock({
          id: block.id,
          day: plan.day,
          startMs: derived.derivedStartMs,
          endMs: derived.derivedEndMs,
        });
  const next: DayPlan = {
    ...without,
    blocks: [...without.blocks, converted],
  };
  return finishPreview(plan, next, confirmedOf(options));
}

/**
 * Removes the block from the day. Does not delete or complete a task [D6].
 */
export function unschedule(
  plan: DayPlan,
  blockId: string,
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  return finishPreview(plan, dropBlock(plan, blockId), confirmedOf(options));
}

export type ScheduleTaskInput =
  | {
      id: string;
      taskId: string;
      type: "fixed";
      startMs: number;
      endMs: number;
    }
  | {
      id: string;
      taskId: string;
      type: "flexible";
      durationMs: number;
      precedingAnchorId: ChainId;
      chainPosition: number;
    };

/**
 * Drag an unscheduled task onto a slot. The caller still chooses the type [D28].
 */
export function scheduleTask(
  plan: DayPlan,
  input: ScheduleTaskInput,
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  if (input.type === "fixed") {
    const block = createFixedTaskBlock({
      id: input.id,
      taskId: input.taskId,
      day: plan.day,
      startMs: input.startMs,
      endMs: input.endMs,
    });
    const next: DayPlan = {
      ...clonePlan(plan),
      blocks: [...plan.blocks.map(cloneBlock), block],
    };
    return finishPreview(plan, next, confirmedOf(options));
  }
  const bumped = bumpPositions(
    plan.blocks,
    input.precedingAnchorId,
    input.chainPosition,
  );
  const block = createFlexibleTaskBlock({
    id: input.id,
    taskId: input.taskId,
    day: plan.day,
    durationMs: input.durationMs,
    chainPosition: input.chainPosition,
    precedingAnchorId: input.precedingAnchorId,
  });
  const next: DayPlan = {
    ...clonePlan(plan),
    blocks: reindexChain([...bumped, block], input.precedingAnchorId),
  };
  return finishPreview(plan, next, confirmedOf(options));
}

export type CreateReserveInput =
  | {
      id: string;
      type: "fixed";
      startMs: number;
      endMs: number;
    }
  | {
      id: string;
      type: "flexible";
      durationMs: number;
      precedingAnchorId: ChainId;
      chainPosition: number;
    };

export function createReserve(
  plan: DayPlan,
  input: CreateReserveInput,
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  if (input.type === "fixed") {
    const block = createFixedReserveBlock({
      id: input.id,
      day: plan.day,
      startMs: input.startMs,
      endMs: input.endMs,
    });
    const next: DayPlan = {
      ...clonePlan(plan),
      blocks: [...plan.blocks.map(cloneBlock), block],
    };
    return finishPreview(plan, next, confirmedOf(options));
  }
  const bumped = bumpPositions(
    plan.blocks,
    input.precedingAnchorId,
    input.chainPosition,
  );
  const block = createFlexibleReserveBlock({
    id: input.id,
    day: plan.day,
    durationMs: input.durationMs,
    chainPosition: input.chainPosition,
    precedingAnchorId: input.precedingAnchorId,
  });
  const next: DayPlan = {
    ...clonePlan(plan),
    blocks: reindexChain([...bumped, block], input.precedingAnchorId),
  };
  return finishPreview(plan, next, confirmedOf(options));
}

function moveBlockPastAnchor(plan: DayPlan, blockId: string): DayPlan {
  const block = requireBlock(plan, blockId);
  if (!isFlexibleBlock(block)) {
    return clonePlan(plan);
  }
  const packed = packDay(plan);
  const interval = packed.intervals.find(
    (item) => item.precedingAnchorId === block.precedingAnchorId,
  );
  if (!interval?.nextAnchorId) {
    return clonePlan(plan);
  }
  const preview = dragFlexibleBody(plan, blockId, {
    precedingAnchorId: interval.nextAnchorId,
    chainPosition: plan.blocks.filter(
      (item) =>
        isFlexibleBlock(item) &&
        item.precedingAnchorId === interval.nextAnchorId,
    ).length,
  });
  return preview.next;
}

/**
 * The five [D27] resolutions. The engine applies none of them on its own.
 */
export function resolveConflict(
  plan: DayPlan,
  params: ResolveConflictParams,
  options?: Partial<ConfirmOptions>,
): MutationPreview {
  const confirmed = confirmedOf(options);
  switch (params.resolution) {
    case "changeDuration":
      return dragEdge(
        plan,
        params.blockId,
        { durationMs: params.durationMs },
        { confirmed },
      );
    case "changeOrder": {
      const block = requireBlock(plan, params.blockId);
      if (!isFlexibleBlock(block)) {
        throw new Error("changeOrder applies to flexible blocks [D27]");
      }
      return dragFlexibleBody(
        plan,
        params.blockId,
        {
          precedingAnchorId: block.precedingAnchorId,
          chainPosition: params.chainPosition,
        },
        { confirmed },
      );
    }
    case "moveBlockPastAnchor":
      return finishPreview(
        plan,
        moveBlockPastAnchor(plan, params.blockId),
        confirmed,
      );
    case "unscheduleBlock":
      return unschedule(plan, params.blockId, { confirmed });
    case "keepConflict": {
      const stamped = finishPreview(plan, clonePlan(plan), confirmed, {
        clearResolved: false,
      }).next;
      const next: DayPlan = {
        ...stamped,
        blocks: stamped.blocks.map((block) =>
          block.conflict
            ? { ...block, conflict: true, keptConflict: true }
            : cloneBlock(block),
        ),
      };
      return finishPreview(plan, next, confirmed, { clearResolved: false });
    }
    default: {
      const exhaustive: never = params;
      throw new Error(`Unknown resolution ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function setRunningBlock(
  plan: DayPlan,
  runningBlockId: string | null,
): DayPlan {
  if (runningBlockId !== null) {
    requireBlock(plan, runningBlockId);
  }
  return { ...clonePlan(plan), runningBlockId };
}
