import { parseWorkieDayStart } from "../domain/workieDay";

/** Five minutes before a running block ends [D1]. */
export const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** Record key for the chain that packs from the day edge. */
export const DAY_START_CHAIN_KEY = "";

export type BlockType = "fixed" | "flexible";

export type ChainId = string | null;

type BlockIdentity = {
  id: string;
  durationMs: number;
  day: string;
  conflict: boolean;
  keptConflict: boolean;
};

type TaskRef = {
  kind: "task";
  taskId: string;
};

type ReserveRef = {
  kind: "reserve";
};

export type FixedTaskBlock = BlockIdentity &
  TaskRef & {
    type: "fixed";
    startMs: number;
    endMs: number;
  };

export type FixedReserveBlock = BlockIdentity &
  ReserveRef & {
    type: "fixed";
    startMs: number;
    endMs: number;
  };

export type FlexibleTaskBlock = BlockIdentity &
  TaskRef & {
    type: "flexible";
    chainPosition: number;
    precedingAnchorId: ChainId;
  };

export type FlexibleReserveBlock = BlockIdentity &
  ReserveRef & {
    type: "flexible";
    chainPosition: number;
    precedingAnchorId: ChainId;
  };

export type FixedBlock = FixedTaskBlock | FixedReserveBlock;
export type FlexibleBlock = FlexibleTaskBlock | FlexibleReserveBlock;
export type TaskCalendarBlock = FixedTaskBlock | FlexibleTaskBlock;
export type ReserveBlock = FixedReserveBlock | FlexibleReserveBlock;
export type CalendarBlock = FixedBlock | FlexibleBlock;

export type PackedBlock = CalendarBlock & {
  derivedStartMs: number;
  derivedEndMs: number;
};

export type DayPlan = {
  day: string;
  blocks: CalendarBlock[];
  runningBlockId: string | null;
  /** Extra start delay on a chain after a fixed-block overrun. Keyed by chainKey. */
  chainStartDelayMs: Record<string, number>;
};

export type AnchorInterval = {
  precedingAnchorId: ChainId;
  startMs: number;
  endMs: number;
  nextAnchorId: string | null;
  nextAnchorStartMs: number | null;
  nextAnchorEndMs: number | null;
};

export type PackedDay = {
  day: string;
  dayStartMs: number;
  dayEndMs: number;
  blocks: PackedBlock[];
  intervals: AnchorInterval[];
};

export type ConflictInfo = {
  collidingBlockId: string;
  anchorId: string;
  affectedBlockIds: string[];
};

export type MutationPreview = {
  next: DayPlan;
  conflicts: ConflictInfo[];
  affectedChains: ChainId[];
  confirmed: boolean;
};

export const CONFLICT_RESOLUTIONS = [
  "changeDuration",
  "changeOrder",
  "moveBlockPastAnchor",
  "unscheduleBlock",
  "keepConflict",
] as const;

export type ConflictResolution = (typeof CONFLICT_RESOLUTIONS)[number];

export type ResolveConflictParams =
  | { resolution: "changeDuration"; blockId: string; durationMs: number }
  | { resolution: "changeOrder"; blockId: string; chainPosition: number }
  | { resolution: "moveBlockPastAnchor"; blockId: string }
  | { resolution: "unscheduleBlock"; blockId: string }
  | { resolution: "keepConflict" };

export type ConfirmOptions = {
  confirmed: boolean;
};

export function chainKey(precedingAnchorId: ChainId): string {
  return precedingAnchorId ?? DAY_START_CHAIN_KEY;
}

export function isFixedBlock(block: CalendarBlock): block is FixedBlock {
  return block.type === "fixed";
}

export function isFlexibleBlock(block: CalendarBlock): block is FlexibleBlock {
  return block.type === "flexible";
}

export function isReserveBlock(block: CalendarBlock): block is ReserveBlock {
  return block.kind === "reserve";
}

export function isTaskBlock(block: CalendarBlock): block is TaskCalendarBlock {
  return block.kind === "task";
}

function assertPositiveDuration(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Block duration must be positive [D21]");
  }
}

function assertRange(startMs: number, endMs: number): number {
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    throw new Error("Fixed block end must be after start [D21]");
  }
  return endMs - startMs;
}

export function createFixedTaskBlock(input: {
  id: string;
  taskId: string;
  day: string;
  startMs: number;
  endMs: number;
  conflict?: boolean;
  keptConflict?: boolean;
}): FixedTaskBlock {
  const durationMs = assertRange(input.startMs, input.endMs);
  return {
    id: input.id,
    kind: "task",
    taskId: input.taskId,
    type: "fixed",
    day: input.day,
    startMs: input.startMs,
    endMs: input.endMs,
    durationMs,
    conflict: input.conflict === true,
    keptConflict: input.keptConflict === true,
  };
}

export function createFixedReserveBlock(input: {
  id: string;
  day: string;
  startMs: number;
  endMs: number;
  conflict?: boolean;
  keptConflict?: boolean;
}): FixedReserveBlock {
  const durationMs = assertRange(input.startMs, input.endMs);
  return {
    id: input.id,
    kind: "reserve",
    type: "fixed",
    day: input.day,
    startMs: input.startMs,
    endMs: input.endMs,
    durationMs,
    conflict: input.conflict === true,
    keptConflict: input.keptConflict === true,
  };
}

export function createFlexibleTaskBlock(input: {
  id: string;
  taskId: string;
  day: string;
  durationMs: number;
  chainPosition: number;
  precedingAnchorId: ChainId;
  conflict?: boolean;
  keptConflict?: boolean;
}): FlexibleTaskBlock {
  assertPositiveDuration(input.durationMs);
  return {
    id: input.id,
    kind: "task",
    taskId: input.taskId,
    type: "flexible",
    day: input.day,
    durationMs: input.durationMs,
    chainPosition: input.chainPosition,
    precedingAnchorId: input.precedingAnchorId,
    conflict: input.conflict === true,
    keptConflict: input.keptConflict === true,
  };
}

export function createFlexibleReserveBlock(input: {
  id: string;
  day: string;
  durationMs: number;
  chainPosition: number;
  precedingAnchorId: ChainId;
  conflict?: boolean;
  keptConflict?: boolean;
}): FlexibleReserveBlock {
  assertPositiveDuration(input.durationMs);
  return {
    id: input.id,
    kind: "reserve",
    type: "flexible",
    day: input.day,
    durationMs: input.durationMs,
    chainPosition: input.chainPosition,
    precedingAnchorId: input.precedingAnchorId,
    conflict: input.conflict === true,
    keptConflict: input.keptConflict === true,
  };
}

export function createDayPlan(
  day: string,
  blocks: readonly CalendarBlock[] = [],
  extras: {
    runningBlockId?: string | null;
    chainStartDelayMs?: Record<string, number>;
  } = {},
): DayPlan {
  parseWorkieDayStart(day);
  return {
    day,
    blocks: blocks.map(cloneBlock),
    runningBlockId: extras.runningBlockId ?? null,
    chainStartDelayMs: { ...(extras.chainStartDelayMs ?? {}) },
  };
}

export function cloneBlock(block: CalendarBlock): CalendarBlock {
  return { ...block };
}

export function clonePlan(plan: DayPlan): DayPlan {
  return {
    day: plan.day,
    blocks: plan.blocks.map(cloneBlock),
    runningBlockId: plan.runningBlockId,
    chainStartDelayMs: { ...plan.chainStartDelayMs },
  };
}

export function requireBlock(plan: DayPlan, blockId: string): CalendarBlock {
  const block = plan.blocks.find((item) => item.id === blockId);
  if (!block) {
    throw new Error(`Unknown block ${blockId}`);
  }
  return block;
}

export function replaceBlock(plan: DayPlan, nextBlock: CalendarBlock): DayPlan {
  const exists = plan.blocks.some((item) => item.id === nextBlock.id);
  if (!exists) {
    throw new Error(`Unknown block ${nextBlock.id}`);
  }
  return {
    ...clonePlan(plan),
    blocks: plan.blocks.map((item) =>
      item.id === nextBlock.id ? cloneBlock(nextBlock) : cloneBlock(item),
    ),
  };
}
