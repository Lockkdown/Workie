import {
  evaluateDayBoundary,
  isOverloadDueToMidnightCrossing,
  mayStartBlockForWorkieDay,
  workieDayOfBlock,
  type DayBoundaryContext,
  type DayBoundaryEvaluation,
  type RunningSpan,
} from "../domain/dayBoundary";
import {
  parseWorkieDayStart,
  startOfWorkieDay,
  workieDayKey,
} from "../domain/workieDay";
import { packDay } from "./packing";
import { type CalendarBlock, type DayPlan, isFixedBlock } from "./types";

export type CalendarDayCloseContext = DayBoundaryContext & {
  plan?: DayPlan;
  runningBlockId?: string | null;
};

export type CalendarDayClose = DayBoundaryEvaluation & {
  runningBlockSplit: false;
  runningBlockOverloadDueToMidnight: false;
  mayStartPreviousDayBlock: false;
};

function spanFromBlock(block: CalendarBlock, plan: DayPlan): RunningSpan {
  if (isFixedBlock(block)) {
    return { startedAt: block.startMs, endsAt: block.endMs };
  }
  const packed = packDay(plan).blocks.find((item) => item.id === block.id);
  if (!packed) {
    return { startedAt: parseWorkieDayStart(plan.day) };
  }
  return { startedAt: packed.derivedStartMs, endsAt: packed.derivedEndMs };
}

/**
 * Day close for the calendar. Wraps T4 `evaluateDayBoundary` [D31] [D100].
 */
export function evaluateCalendarDayClose(
  now: number,
  context: CalendarDayCloseContext = {},
): CalendarDayClose {
  let runningBlock = context.runningBlock;
  const plan = context.plan;
  const runningBlockId = context.runningBlockId ?? plan?.runningBlockId ?? null;
  if (!runningBlock && plan && runningBlockId) {
    const block = plan.blocks.find((item) => item.id === runningBlockId);
    if (block) {
      runningBlock = spanFromBlock(block, plan);
    }
  }

  const evaluation = evaluateDayBoundary(now, {
    runningBlock,
    runningSession: context.runningSession,
    unfinishedCycleStatus: context.unfinishedCycleStatus,
  });

  return {
    ...evaluation,
    runningBlockSplit: false,
    runningBlockOverloadDueToMidnight: false,
    mayStartPreviousDayBlock: false,
  };
}

/**
 * Block membership is the Workie day it started on, unless it was never
 * started after 00:00 — then it belongs to the new day [D31].
 */
export function attributeBlockDay(
  block: { startedAt: number },
  now: number,
  isRunning: boolean,
): string {
  const startDay = workieDayOfBlock(block);
  if (isRunning) {
    return startDay;
  }
  const today = workieDayKey(now);
  if (startDay < today && now >= startOfWorkieDay(now)) {
    return today;
  }
  return startDay;
}

export function mayStartBlockOnDay(day: string, now: number): boolean {
  return mayStartBlockForWorkieDay(day, now);
}

export function midnightCrossingIsOverload(): boolean {
  return isOverloadDueToMidnightCrossing();
}

export function blockStartedAt(block: CalendarBlock, plan: DayPlan): number {
  if (isFixedBlock(block)) {
    return block.startMs;
  }
  const packed = packDay(plan).blocks.find((item) => item.id === block.id);
  return packed?.derivedStartMs ?? parseWorkieDayStart(plan.day);
}
