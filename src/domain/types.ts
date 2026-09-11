/** Canonical task statuses. Names locked by [D11] [D86]. */
export const TASK_STATUSES = [
  "Waiting",
  "In Progress",
  "Deferred",
  "Completed",
  "Abandoned",
  "Cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const LIVE_STATUSES = ["Waiting", "In Progress", "Deferred"] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

export const CLOSED_STATUSES = ["Completed", "Abandoned", "Cancelled"] as const;
export type ClosedStatus = (typeof CLOSED_STATUSES)[number];

/** The three unfinished outcomes stay distinct [D7]. */
export const UNFINISHED_OUTCOMES = [
  "Deferred",
  "Abandoned",
  "Cancelled",
] as const;
export type UnfinishedOutcome = (typeof UNFINISHED_OUTCOMES)[number];

export const KANBAN_COLUMNS = [
  "Waiting",
  "In Progress",
  "Deferred",
  "Closed",
] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export const CLOSED_SUBGROUPS = CLOSED_STATUSES;
export type ClosedSubgroup = ClosedStatus;

/** Sunday=0 … Saturday=6, matching `Date.getDay()` in local time. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type UserSource = {
  kind: "user";
  accountId: string;
};

/** AI mark plus source name; source mark and item key on imported tasks [D8] [D15] [D59]. */
export type AiSource = {
  kind: "ai";
  sourceName: string;
  sourceMark: string;
  itemKey: string;
};

export type TaskSource = UserSource | AiSource;

export type StatusEntityKind = "task" | "occurrence";

type StatusEntityBase = {
  id: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  blockIds: string[];
  /** Opaque focus-session / cycle ids. T9 owns the real records [D14]. */
  focusHistory: string[];
  liveOrder?: number;
};

export type Task = StatusEntityBase & {
  kind: "task";
  title: string;
  description?: string;
  subtasks: Subtask[];
  source: TaskSource;
  /** Weekday set only. Omitted = one-off [D10] [D13]. */
  repeatWeekdays?: Weekday[];
};

export type Occurrence = StatusEntityBase & {
  kind: "occurrence";
  taskId: string;
  date: string;
};

export type StatusEntity = Task | Occurrence;

/** One task entering one status on one Workie day [D50]. */
export type StatusHistoryEvent = {
  id: string;
  entityId: string;
  entityKind: StatusEntityKind;
  status: TaskStatus;
  workieDay: string;
  at: number;
  createdAt: number;
  updatedAt: number;
};

export type CreateTaskInput = {
  id: string;
  title: string;
  now: number;
  source: TaskSource;
  description?: string;
  subtasks?: readonly Subtask[];
  repeatWeekdays?: readonly number[];
};

export type CreateOccurrenceInput = {
  id: string;
  taskId: string;
  date: string;
  now: number;
};

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function isLiveStatus(status: TaskStatus): status is LiveStatus {
  return (
    status === "Waiting" || status === "In Progress" || status === "Deferred"
  );
}

export function isClosedStatus(status: TaskStatus): status is ClosedStatus {
  return (
    status === "Completed" || status === "Abandoned" || status === "Cancelled"
  );
}

export function kanbanColumn(status: TaskStatus): KanbanColumn {
  if (isClosedStatus(status)) {
    return "Closed";
  }
  return status;
}

export function closedSubgroup(status: TaskStatus): ClosedSubgroup | undefined {
  return isClosedStatus(status) ? status : undefined;
}
