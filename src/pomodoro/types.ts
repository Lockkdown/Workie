/** Default budget on a fresh install [D42]. */
export const DEFAULT_BUDGET_MS = 30 * 60 * 1000;

/** Offered short break after `Timer complete` [D43]. */
export const BREAK_MS = 5 * 60 * 1000;

export const UNFINISHED_CYCLE_STATES = [
  "running",
  "paused",
  "awaiting task selection",
  "awaiting reconciliation",
] as const;

export type UnfinishedCycleState = (typeof UNFINISHED_CYCLE_STATES)[number];

export const CYCLE_OUTCOMES = [
  "Timer complete",
  "Stopped early",
  "Discarded",
] as const;

export type CycleOutcome = (typeof CYCLE_OUTCOMES)[number];

export type CycleState = UnfinishedCycleState | "ended";

export const SESSION_CLOSE_REASONS = ["Switched task", "Cycle ended"] as const;

export type SessionCloseReason = (typeof SESSION_CLOSE_REASONS)[number];

export type PreparedContext = {
  taskId: string;
  blockId: string | null;
  defaultBudgetMs: number;
};

export type FocusSegment = {
  id: string;
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
};

export type FocusSession = {
  id: string;
  cycleId: string;
  taskId: string;
  /** `null` means the session is recorded Unscheduled [D39]. */
  blockId: string | null;
  startedAt: number;
  endedAt: number | null;
  closeReason: SessionCloseReason | null;
  workieDay: string;
  segments: FocusSegment[];
};

export type PomodoroCycle = {
  id: string;
  workieDay: string;
  budgetMs: number;
  state: CycleState;
  outcome: CycleOutcome | null;
  startedAt: number;
  lastCertainAt: number;
  currentSessionId: string | null;
  sessions: FocusSession[];
  createdAt: number;
  updatedAt: number;
};

export type EngineIds = {
  cycleId: string;
  sessionId: string;
  segmentId: string;
};

export type SwitchIds = {
  sessionId: string;
  segmentId: string;
};

export type StartOk = { ok: true; cycle: PomodoroCycle };
export type StartBlocked = {
  ok: false;
  reason: "unfinished-exists";
  cycle: PomodoroCycle;
};
export type StartResult = StartOk | StartBlocked;

export type ReconcileChoice = "focus" | "pause" | "discard";

export type DiscardResult = {
  cycle: PomodoroCycle;
  closeProvisionalDay: boolean;
};
