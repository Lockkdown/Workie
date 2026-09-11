import { addLocalDays, startOfWorkieDay, workieDayKey } from "./workieDay";

export type RunningSpan = {
  startedAt: number;
  endsAt?: number;
};

export type DayBoundaryContext = {
  runningBlock?: RunningSpan;
  runningSession?: RunningSpan;
  unfinishedCycleStatus?: "awaiting reconciliation";
};

export type DayBoundaryEvaluation = {
  currentWorkieDay: string;
  previousWorkieDay: string;
  previousDayClosed: boolean;
  previousDayProvisional: boolean;
  runningBlockStaysInPreviousDay: boolean;
  runningSessionStaysInPreviousDay: boolean;
  /** A running block is never split across the boundary [D31]. */
  runningBlockSplit: false;
  /** Ending after midnight is not overload by itself [D31]. */
  runningBlockOverloadDueToMidnight: false;
  /** After 00:00, start no further block of the old day [D31]. */
  mayStartPreviousDayBlock: false;
};

export function isSpanRunningAt(span: RunningSpan, now: number): boolean {
  if (now < span.startedAt) {
    return false;
  }
  if (span.endsAt === undefined) {
    return true;
  }
  return now < span.endsAt;
}

/**
 * Block membership is the Workie day it started on. A run across 00:00
 * stays in that day and is not duplicated [D31].
 */
export function workieDayOfBlock(block: RunningSpan): string {
  return workieDayKey(block.startedAt);
}

export function isOverloadDueToMidnightCrossing(): boolean {
  return false;
}

/** After 00:00, no further block of an older Workie day may start [D31]. */
export function mayStartBlockForWorkieDay(day: string, now: number): boolean {
  return day >= workieDayKey(now);
}

export function evaluateDayBoundary(
  now: number,
  context: DayBoundaryContext = {},
): DayBoundaryEvaluation {
  const currentStart = startOfWorkieDay(now);
  const currentWorkieDay = workieDayKey(now);
  const previousWorkieDay = workieDayKey(addLocalDays(currentStart, -1));

  const runningBlockStaysInPreviousDay = Boolean(
    context.runningBlock &&
    context.runningBlock.startedAt < currentStart &&
    isSpanRunningAt(context.runningBlock, now),
  );
  const runningSessionStaysInPreviousDay = Boolean(
    context.runningSession &&
    context.runningSession.startedAt < currentStart &&
    isSpanRunningAt(context.runningSession, now),
  );
  const previousDayProvisional =
    context.unfinishedCycleStatus === "awaiting reconciliation";
  const previousDayClosed =
    !runningBlockStaysInPreviousDay &&
    !runningSessionStaysInPreviousDay &&
    !previousDayProvisional;

  return {
    currentWorkieDay,
    previousWorkieDay,
    previousDayClosed,
    previousDayProvisional,
    runningBlockStaysInPreviousDay,
    runningSessionStaysInPreviousDay,
    runningBlockSplit: false,
    runningBlockOverloadDueToMidnight: false,
    mayStartPreviousDayBlock: false,
  };
}
