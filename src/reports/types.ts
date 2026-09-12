import type { TaskStatus } from "../domain/types";

export const PERIOD_KINDS = ["Day", "Week", "Month", "Year"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export type Period = {
  kind: PeriodKind;
  startMs: number;
  endMs: number;
};

export type Bar = {
  key: string;
  label: string;
  ms: number;
};

export type TaskRow = {
  taskId: string;
  title: string;
  ms: number;
  share: number;
};

export type OutcomeStatus =
  "Completed" | "Abandoned" | "Cancelled" | "Deferred";

export const OUTCOME_STATUSES: readonly OutcomeStatus[] = [
  "Completed",
  "Abandoned",
  "Cancelled",
  "Deferred",
];

export type OutcomeCounts = Record<OutcomeStatus, number>;

export type OutcomeEvent = {
  id: string;
  entityId: string;
  entityKind: "task" | "occurrence";
  status: OutcomeStatus;
  workieDay: string;
  at: number;
  title: string;
};

export type ContributionLevel = "0" | "1" | "2" | "3" | "4+";

export type ContributionCell = {
  day: string;
  count: number;
  level: ContributionLevel;
};

export type DiscardedTrace = {
  cycleId: string;
  workieDay: string;
  sessionCount: number;
};

export type WorkingTimeReport = {
  totalMs: number;
  bars: Bar[];
  rows: TaskRow[];
  discarded: DiscardedTrace[];
};

export type OutcomeReport = {
  counts: OutcomeCounts;
  events: OutcomeEvent[];
};

export function isOutcomeStatus(status: TaskStatus): status is OutcomeStatus {
  return (
    status === "Completed" ||
    status === "Abandoned" ||
    status === "Cancelled" ||
    status === "Deferred"
  );
}
