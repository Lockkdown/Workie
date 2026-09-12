import { remainingMs } from "../domain/remainingTime";
import { atMostOneUnfinishedCycle } from "../domain/unfinishedCycle";
import { workieDayKey } from "../domain/workieDay";
import {
  BREAK_MS,
  DEFAULT_BUDGET_MS,
  UNFINISHED_CYCLE_STATES,
  type CycleOutcome,
  type DiscardResult,
  type EngineIds,
  type FocusSegment,
  type FocusSession,
  type PomodoroCycle,
  type PreparedContext,
  type ReconcileChoice,
  type StartResult,
  type SwitchIds,
  type UnfinishedCycleState,
} from "./types";

export function prepareContext(input: {
  taskId: string;
  blockId?: string | null;
  defaultBudgetMs?: number;
}): PreparedContext {
  return {
    taskId: input.taskId,
    blockId: input.blockId ?? null,
    defaultBudgetMs: input.defaultBudgetMs ?? DEFAULT_BUDGET_MS,
  };
}

export function isUnfinishedState(
  state: PomodoroCycle["state"],
): state is UnfinishedCycleState {
  return (UNFINISHED_CYCLE_STATES as readonly string[]).includes(state);
}

export function isUnfinishedCycle(cycle: PomodoroCycle): boolean {
  return isUnfinishedState(cycle.state);
}

export function findUnfinished(
  cycles: readonly PomodoroCycle[],
): PomodoroCycle | undefined {
  return cycles.find(isUnfinishedCycle);
}

export function unfinishedCount(cycles: readonly PomodoroCycle[]): number {
  return cycles.filter(isUnfinishedCycle).length;
}

export function isCountedCompletedPomodoro(cycle: PomodoroCycle): boolean {
  return cycle.state === "ended" && cycle.outcome === "Timer complete";
}

export function cloneSegment(segment: FocusSegment): FocusSegment {
  return { ...segment };
}

export function cloneSession(session: FocusSession): FocusSession {
  return {
    ...session,
    segments: session.segments.map(cloneSegment),
  };
}

export function cloneCycle(cycle: PomodoroCycle): PomodoroCycle {
  return {
    ...cycle,
    sessions: cycle.sessions.map(cloneSession),
  };
}

function requireCurrentSession(cycle: PomodoroCycle): FocusSession {
  const session = cycle.sessions.find(
    (item) => item.id === cycle.currentSessionId,
  );
  if (!session) {
    throw new Error("Cycle has no current session [D35]");
  }
  return session;
}

function replaceSession(
  cycle: PomodoroCycle,
  session: FocusSession,
): PomodoroCycle {
  return {
    ...cloneCycle(cycle),
    sessions: cycle.sessions.map((item) =>
      item.id === session.id ? cloneSession(session) : cloneSession(item),
    ),
  };
}

function closeOpenSegment(session: FocusSession, at: number): FocusSession {
  return {
    ...cloneSession(session),
    segments: session.segments.map((segment) =>
      segment.endedAt === null
        ? { ...segment, endedAt: at }
        : cloneSegment(segment),
    ),
  };
}

function openSegment(
  session: FocusSession,
  id: string,
  at: number,
): FocusSession {
  return {
    ...cloneSession(session),
    segments: [
      ...session.segments.map(cloneSegment),
      { id, sessionId: session.id, startedAt: at, endedAt: null },
    ],
  };
}

/** Closed-segment focus plus the open running segment up to `now`, capped by budget. */
export function confirmedFocusMs(cycle: PomodoroCycle, now: number): number {
  let total = 0;
  for (const session of cycle.sessions) {
    for (const segment of session.segments) {
      const end =
        segment.endedAt ??
        (cycle.state === "running" ? now : segment.startedAt);
      total += Math.max(0, end - segment.startedAt);
    }
  }
  return Math.min(total, cycle.budgetMs);
}

export function remainingBudgetMs(cycle: PomodoroCycle, now: number): number {
  return remainingMs(cycle.budgetMs, confirmedFocusMs(cycle, now));
}

export function budgetEndsAt(cycle: PomodoroCycle): number | null {
  if (cycle.state !== "running") {
    return null;
  }
  const session = cycle.sessions.find(
    (item) => item.id === cycle.currentSessionId,
  );
  const open = session?.segments.find((segment) => segment.endedAt === null);
  if (!open) {
    return null;
  }
  const closed = confirmedFocusMs(
    { ...cycle, state: "paused" },
    open.startedAt,
  );
  return open.startedAt + (cycle.budgetMs - closed);
}

export function sessionsOverlap(cycle: PomodoroCycle): boolean {
  const spans = cycle.sessions
    .map((session) => {
      const end = session.endedAt ?? Number.POSITIVE_INFINITY;
      return { start: session.startedAt, end, id: session.id };
    })
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  for (let i = 1; i < spans.length; i += 1) {
    const prev = spans[i - 1];
    const next = spans[i];
    if (prev && next && prev.end > next.start) {
      return true;
    }
  }
  return false;
}

function stamp(cycle: PomodoroCycle, now: number): PomodoroCycle {
  return { ...cycle, updatedAt: now, lastCertainAt: now };
}

function endCycle(
  cycle: PomodoroCycle,
  now: number,
  outcome: CycleOutcome,
): PomodoroCycle {
  let next = cloneCycle(cycle);
  if (next.currentSessionId) {
    const session = closeOpenSegment(requireCurrentSession(next), now);
    session.endedAt = now;
    session.closeReason = "Cycle ended";
    next = replaceSession(next, session);
  }
  return stamp(
    {
      ...next,
      state: "ended",
      outcome,
      currentSessionId: null,
    },
    now,
  );
}

export function startCycle(
  cycles: readonly PomodoroCycle[],
  prepared: PreparedContext,
  now: number,
  ids: EngineIds,
): StartResult {
  const existing = findUnfinished(cycles);
  if (existing) {
    return { ok: false, reason: "unfinished-exists", cycle: existing };
  }
  if (!atMostOneUnfinishedCycle(unfinishedCount(cycles) + 1)) {
    return {
      ok: false,
      reason: "unfinished-exists",
      cycle: cycles.filter(isUnfinishedCycle)[0]!,
    };
  }
  const workieDay = workieDayKey(now);
  const session: FocusSession = {
    id: ids.sessionId,
    cycleId: ids.cycleId,
    taskId: prepared.taskId,
    blockId: prepared.blockId,
    startedAt: now,
    endedAt: null,
    closeReason: null,
    workieDay,
    segments: [
      {
        id: ids.segmentId,
        sessionId: ids.sessionId,
        startedAt: now,
        endedAt: null,
      },
    ],
  };
  const cycle: PomodoroCycle = {
    id: ids.cycleId,
    workieDay,
    budgetMs: prepared.defaultBudgetMs,
    state: "running",
    outcome: null,
    startedAt: now,
    lastCertainAt: now,
    currentSessionId: session.id,
    sessions: [session],
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, cycle };
}

export function pauseCycle(cycle: PomodoroCycle, now: number): PomodoroCycle {
  if (cycle.state !== "running") {
    return cloneCycle(cycle);
  }
  const session = closeOpenSegment(requireCurrentSession(cycle), now);
  return stamp(
    {
      ...replaceSession(cycle, session),
      state: "paused",
    },
    now,
  );
}

export function resumePaused(
  cycle: PomodoroCycle,
  now: number,
  segmentId: string,
): PomodoroCycle {
  if (cycle.state !== "paused") {
    return cloneCycle(cycle);
  }
  const session = openSegment(requireCurrentSession(cycle), segmentId, now);
  return stamp(
    {
      ...replaceSession(cycle, session),
      state: "running",
    },
    now,
  );
}

export function beginSwitch(cycle: PomodoroCycle, now: number): PomodoroCycle {
  if (cycle.state !== "running" && cycle.state !== "paused") {
    return cloneCycle(cycle);
  }
  let session =
    cycle.state === "running"
      ? closeOpenSegment(requireCurrentSession(cycle), now)
      : cloneSession(requireCurrentSession(cycle));
  session = {
    ...session,
    endedAt: now,
    closeReason: "Switched task",
  };
  return stamp(
    {
      ...replaceSession(cycle, session),
      state: "awaiting task selection",
      currentSessionId: null,
    },
    now,
  );
}

export function resumeOnTask(
  cycle: PomodoroCycle,
  input: {
    taskId: string;
    blockId: string | null;
    now: number;
    ids: SwitchIds;
  },
): PomodoroCycle {
  if (cycle.state !== "awaiting task selection") {
    return cloneCycle(cycle);
  }
  const session: FocusSession = {
    id: input.ids.sessionId,
    cycleId: cycle.id,
    taskId: input.taskId,
    blockId: input.blockId,
    startedAt: input.now,
    endedAt: null,
    closeReason: null,
    workieDay: cycle.workieDay,
    segments: [
      {
        id: input.ids.segmentId,
        sessionId: input.ids.sessionId,
        startedAt: input.now,
        endedAt: null,
      },
    ],
  };
  return stamp(
    {
      ...cloneCycle(cycle),
      state: "running",
      currentSessionId: session.id,
      sessions: [...cycle.sessions.map(cloneSession), session],
    },
    input.now,
  );
}

export function stopEarly(cycle: PomodoroCycle, now: number): PomodoroCycle {
  if (!isUnfinishedCycle(cycle)) {
    return cloneCycle(cycle);
  }
  let next = cycle;
  if (cycle.state === "running") {
    next = pauseCycle(cycle, now);
  }
  return endCycle(next, now, "Stopped early");
}

export function discardCycle(cycle: PomodoroCycle, now: number): DiscardResult {
  if (!isUnfinishedCycle(cycle) && cycle.outcome !== null) {
    return { cycle: cloneCycle(cycle), closeProvisionalDay: false };
  }
  let next = cycle;
  if (cycle.state === "running") {
    next = pauseCycle(cycle, now);
  }
  if (cycle.state === "awaiting task selection" && cycle.currentSessionId) {
    const session = requireCurrentSession(cycle);
    next = replaceSession(cycle, {
      ...cloneSession(session),
      endedAt: session.endedAt ?? now,
      closeReason: session.closeReason ?? "Cycle ended",
    });
  }
  const ended = endCycle(next, now, "Discarded");
  const closeProvisionalDay = ended.workieDay < workieDayKey(now);
  return { cycle: ended, closeProvisionalDay };
}

export function loseObservation(
  cycle: PomodoroCycle,
  now: number,
): PomodoroCycle {
  if (cycle.state !== "running") {
    return cloneCycle(cycle);
  }
  const session = closeOpenSegment(requireCurrentSession(cycle), now);
  return stamp(
    {
      ...replaceSession(cycle, session),
      state: "awaiting reconciliation",
    },
    now,
  );
}

export function recoverRunningOnLoad(
  cycle: PomodoroCycle,
  now: number,
): PomodoroCycle {
  if (cycle.state !== "running") {
    return cloneCycle(cycle);
  }
  return loseObservation(
    cycle,
    cycle.lastCertainAt < now ? cycle.lastCertainAt : now,
  );
}

function creditGapAsFocus(
  cycle: PomodoroCycle,
  now: number,
  segmentId: string,
): PomodoroCycle {
  const remaining = remainingBudgetMs(
    { ...cycle, state: "paused" },
    cycle.lastCertainAt,
  );
  const gap = Math.max(0, now - cycle.lastCertainAt);
  const credited = Math.min(gap, remaining);
  const session = requireCurrentSession(cycle);
  const gapSegment: FocusSegment = {
    id: segmentId,
    sessionId: session.id,
    startedAt: cycle.lastCertainAt,
    endedAt: cycle.lastCertainAt + credited,
  };
  let nextSession: FocusSession = {
    ...cloneSession(session),
    segments: [...session.segments.map(cloneSegment), gapSegment],
  };
  const withGap: PomodoroCycle = replaceSession(cycle, nextSession);
  if (credited >= remaining) {
    return endCycle(withGap, cycle.lastCertainAt + credited, "Timer complete");
  }
  const resumeId = `${segmentId}-resume`;
  nextSession = openSegment(nextSession, resumeId, now);
  return stamp(
    {
      ...replaceSession(withGap, nextSession),
      state: "running",
    },
    now,
  );
}

function creditGapAsPause(
  cycle: PomodoroCycle,
  now: number,
  segmentId: string,
): PomodoroCycle {
  const session = openSegment(requireCurrentSession(cycle), segmentId, now);
  return stamp(
    {
      ...replaceSession(cycle, session),
      state: "running",
    },
    now,
  );
}

export function reconcile(
  cycle: PomodoroCycle,
  choice: ReconcileChoice,
  now: number,
  segmentId: string,
): DiscardResult {
  if (cycle.state !== "awaiting reconciliation") {
    return { cycle: cloneCycle(cycle), closeProvisionalDay: false };
  }
  if (choice === "discard") {
    return discardCycle(cycle, now);
  }
  if (choice === "focus") {
    return {
      cycle: creditGapAsFocus(cycle, now, segmentId),
      closeProvisionalDay: false,
    };
  }
  return {
    cycle: creditGapAsPause(cycle, now, segmentId),
    closeProvisionalDay: false,
  };
}

export function tickRunning(cycle: PomodoroCycle, now: number): PomodoroCycle {
  if (cycle.state !== "running") {
    return cloneCycle(cycle);
  }
  const endsAt = budgetEndsAt(cycle);
  if (endsAt === null) {
    return stamp(cloneCycle(cycle), now);
  }
  if (now < endsAt) {
    return stamp(cloneCycle(cycle), now);
  }
  return endCycle(cycle, endsAt, "Timer complete");
}

export function noteCertain(cycle: PomodoroCycle, now: number): PomodoroCycle {
  if (cycle.state !== "running") {
    return cloneCycle(cycle);
  }
  return { ...cloneCycle(cycle), lastCertainAt: now, updatedAt: now };
}

export function sessionIsUnscheduled(session: FocusSession): boolean {
  return session.blockId === null;
}

/** Unscheduled sessions never push the calendar [D39]. */
export function shouldPushCalendar(input: {
  session: FocusSession;
  blockEndMs: number | null;
  now: number;
}): boolean {
  if (sessionIsUnscheduled(input.session) || input.blockEndMs === null) {
    return false;
  }
  return input.now > input.blockEndMs;
}

export function warnFiveMinutes(input: {
  session: FocusSession;
  blockEndMs: number | null;
  now: number;
}): boolean {
  if (sessionIsUnscheduled(input.session) || input.blockEndMs === null) {
    return false;
  }
  const remaining = input.blockEndMs - input.now;
  return remaining > 0 && remaining <= 5 * 60 * 1000;
}

export function cycleDoesNotStopForBlockEnd(): true {
  return true;
}

export type OfferedBreak = {
  offered: boolean;
  running: boolean;
  startedAt: number | null;
  durationMs: number;
};

export function offerBreak(): OfferedBreak {
  return {
    offered: true,
    running: false,
    startedAt: null,
    durationMs: BREAK_MS,
  };
}

export function startBreak(now: number): OfferedBreak {
  return {
    offered: true,
    running: true,
    startedAt: now,
    durationMs: BREAK_MS,
  };
}

export function skipBreak(): OfferedBreak {
  return {
    offered: false,
    running: false,
    startedAt: null,
    durationMs: BREAK_MS,
  };
}

export function tickBreak(current: OfferedBreak, now: number): OfferedBreak {
  if (!current.running || current.startedAt === null) {
    return current;
  }
  if (now - current.startedAt >= current.durationMs) {
    return skipBreak();
  }
  return current;
}

export function breakProducesFocusTime(): false {
  return false;
}

export function breakCreatesReserve(): false {
  return false;
}
