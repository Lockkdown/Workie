import type { WorkieDB } from "../db/schema";
import type { FocusSegment, FocusSession, PomodoroCycle } from "./types";
import { DEFAULT_BUDGET_MS } from "./types";

export const SETTING_DEFAULT_BUDGET = "pomodoro.defaultBudgetMs";
export const SETTING_SOUND = "pomodoro.soundOptIn";
export const SETTING_ALERTS = "pomodoro.alertsOptIn";

function asCycleState(value: string | undefined): PomodoroCycle["state"] {
  if (
    value === "running" ||
    value === "paused" ||
    value === "awaiting task selection" ||
    value === "awaiting reconciliation" ||
    value === "ended"
  ) {
    return value;
  }
  return "ended";
}

function asOutcome(value: string | null | undefined): PomodoroCycle["outcome"] {
  if (
    value === "Timer complete" ||
    value === "Stopped early" ||
    value === "Discarded"
  ) {
    return value;
  }
  return null;
}

function asCloseReason(
  value: string | null | undefined,
): FocusSession["closeReason"] {
  if (value === "Switched task" || value === "Cycle ended") {
    return value;
  }
  return null;
}

export async function loadDefaultBudgetMs(db: WorkieDB): Promise<number> {
  const row = await db.settings.get(SETTING_DEFAULT_BUDGET);
  const parsed = Number(row?.value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_BUDGET_MS;
}

export async function saveDefaultBudgetMs(
  db: WorkieDB,
  budgetMs: number,
  now: number,
): Promise<void> {
  const existing = await db.settings.get(SETTING_DEFAULT_BUDGET);
  await db.settings.put({
    id: SETTING_DEFAULT_BUDGET,
    value: String(budgetMs),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function loadFlag(db: WorkieDB, id: string): Promise<boolean> {
  const row = await db.settings.get(id);
  return row?.value === "1";
}

export async function saveFlag(
  db: WorkieDB,
  id: string,
  value: boolean,
  now: number,
): Promise<void> {
  const existing = await db.settings.get(id);
  await db.settings.put({
    id,
    value: value ? "1" : "0",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function loadCycles(db: WorkieDB): Promise<PomodoroCycle[]> {
  const [cycleRows, sessionRows, segmentRows] = await Promise.all([
    db.pomodoroCycles.toArray(),
    db.sessions.toArray(),
    db.segments.toArray(),
  ]);
  const segmentsBySession = new Map<string, FocusSegment[]>();
  for (const row of segmentRows) {
    if (!row.sessionId || row.startedAt === undefined) {
      continue;
    }
    const list = segmentsBySession.get(row.sessionId) ?? [];
    list.push({
      id: row.id,
      sessionId: row.sessionId,
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? null,
    });
    segmentsBySession.set(row.sessionId, list);
  }
  const sessionsByCycle = new Map<string, FocusSession[]>();
  for (const row of sessionRows) {
    if (!row.cycleId || !row.taskId || row.startedAt === undefined) {
      continue;
    }
    const list = sessionsByCycle.get(row.cycleId) ?? [];
    list.push({
      id: row.id,
      cycleId: row.cycleId,
      taskId: row.taskId,
      blockId: row.blockId ?? null,
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? null,
      closeReason: asCloseReason(row.closeReason),
      workieDay: row.workieDay ?? "",
      segments: (segmentsBySession.get(row.id) ?? []).sort(
        (a, b) => a.startedAt - b.startedAt,
      ),
    });
    sessionsByCycle.set(row.cycleId, list);
  }
  return cycleRows
    .filter((row) => row.budgetMs !== undefined && row.startedAt != null)
    .map((row) => ({
      id: row.id,
      workieDay: row.workieDay ?? "",
      budgetMs: row.budgetMs ?? DEFAULT_BUDGET_MS,
      state: asCycleState(row.state),
      outcome: asOutcome(row.outcome),
      startedAt: row.startedAt ?? row.createdAt,
      lastCertainAt: row.lastCertainAt ?? row.updatedAt,
      currentSessionId: row.currentSessionId ?? null,
      sessions: (sessionsByCycle.get(row.id) ?? []).sort(
        (a, b) => a.startedAt - b.startedAt,
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function persistCycle(
  db: WorkieDB,
  cycle: PomodoroCycle,
): Promise<void> {
  const keepSessions = new Set(cycle.sessions.map((session) => session.id));
  const keepSegments = new Set(
    cycle.sessions.flatMap((session) =>
      session.segments.map((segment) => segment.id),
    ),
  );
  await db.transaction(
    "rw",
    db.pomodoroCycles,
    db.sessions,
    db.segments,
    async () => {
      await db.pomodoroCycles.put({
        id: cycle.id,
        createdAt: cycle.createdAt,
        updatedAt: cycle.updatedAt,
        workieDay: cycle.workieDay,
        budgetMs: cycle.budgetMs,
        state: cycle.state,
        outcome: cycle.outcome,
        startedAt: cycle.startedAt,
        lastCertainAt: cycle.lastCertainAt,
        currentSessionId: cycle.currentSessionId,
      });
      const existingSessions = await db.sessions.toArray();
      const ownedSessionIds = existingSessions
        .filter((row) => row.cycleId === cycle.id)
        .map((row) => row.id);
      for (const id of ownedSessionIds) {
        if (!keepSessions.has(id)) {
          await db.sessions.delete(id);
        }
      }
      const existingSegments = await db.segments.toArray();
      for (const row of existingSegments) {
        const owned =
          row.sessionId !== undefined &&
          ownedSessionIds.includes(row.sessionId);
        if (owned && !keepSegments.has(row.id)) {
          await db.segments.delete(row.id);
        }
      }
      for (const session of cycle.sessions) {
        await db.sessions.put({
          id: session.id,
          createdAt: session.startedAt,
          updatedAt: session.endedAt ?? cycle.updatedAt,
          cycleId: session.cycleId,
          taskId: session.taskId,
          blockId: session.blockId,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          closeReason: session.closeReason,
          workieDay: session.workieDay,
        });
        for (const segment of session.segments) {
          await db.segments.put({
            id: segment.id,
            createdAt: segment.startedAt,
            updatedAt: segment.endedAt ?? cycle.updatedAt,
            sessionId: segment.sessionId,
            startedAt: segment.startedAt,
            endedAt: segment.endedAt,
          });
        }
      }
    },
  );
}
