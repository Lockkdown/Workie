import Dexie, { type Table } from "dexie";
import type { CalendarBlock } from "../calendar/types";
import type { Occurrence, StatusHistoryEvent, Task } from "../domain/types";

export type ScaffoldRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
};

export type SettingRecord = {
  id: string;
  value: string;
  createdAt: number;
  updatedAt: number;
};

/** Durable calendar block. Day extras live in `settings` as `dayPlan:${day}` [D96]. */
export type PersistedBlock = CalendarBlock & {
  createdAt: number;
  updatedAt: number;
  taskId?: string;
};

/** v2–v4 scaffold rows remain valid until rewritten as calendar blocks. */
export type BlockTableRecord = PersistedBlock | ScaffoldRecord;

/** T8 draft / committed plan for one Workie day [D23] [D96]. */
export type PlanningDraftRecord = ScaffoldRecord & {
  day?: string;
  commitState?: "draft" | "committed";
  step?: number;
  selectedJson?: string;
  keepAnyway?: number;
  planJson?: string;
  ownersJson?: string;
  revisionsJson?: string;
};

/** T9 cycle row. Nested sessions live in `sessions` / `segments` [D35] [D96]. */
export type PomodoroCycleRecord = ScaffoldRecord & {
  workieDay?: string;
  budgetMs?: number;
  state?: string;
  outcome?: string | null;
  startedAt?: number | null;
  lastCertainAt?: number | null;
  currentSessionId?: string | null;
};

export type FocusSessionRecord = ScaffoldRecord & {
  cycleId?: string;
  taskId?: string;
  blockId?: string | null;
  startedAt?: number;
  endedAt?: number | null;
  closeReason?: string | null;
  workieDay?: string;
};

export type FocusSegmentRecord = ScaffoldRecord & {
  sessionId?: string;
  startedAt?: number;
  endedAt?: number | null;
};

export const WORKIE_TABLES = [
  "tasks",
  "occurrences",
  "blocks",
  "planningDrafts",
  "statusHistory",
  "pomodoroCycles",
  "sessions",
  "segments",
  "importReviewDrafts",
] as const;

export class WorkieDB extends Dexie {
  tasks!: Table<Task, string>;
  occurrences!: Table<Occurrence, string>;
  blocks!: Table<BlockTableRecord, string>;
  planningDrafts!: Table<PlanningDraftRecord, string>;
  statusHistory!: Table<StatusHistoryEvent, string>;
  pomodoroCycles!: Table<PomodoroCycleRecord, string>;
  sessions!: Table<FocusSessionRecord, string>;
  segments!: Table<FocusSegmentRecord, string>;
  importReviewDrafts!: Table<ScaffoldRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor(name = "workie") {
    super(name);
    this.version(1).stores({
      tasks: "id",
    });
    this.version(2).stores({
      tasks: "id, createdAt, updatedAt",
      occurrences: "id, createdAt, updatedAt",
      blocks: "id, createdAt, updatedAt",
      planningDrafts: "id, createdAt, updatedAt",
      statusHistory: "id, createdAt, updatedAt",
      pomodoroCycles: "id, createdAt, updatedAt",
      sessions: "id, createdAt, updatedAt",
      segments: "id, createdAt, updatedAt",
      importReviewDrafts: "id, createdAt, updatedAt",
    });
    this.version(3).stores({
      tasks: "id, status, createdAt, updatedAt, *blockIds",
      occurrences:
        "id, taskId, date, [taskId+date], status, createdAt, updatedAt, *blockIds",
      blocks: "id, createdAt, updatedAt",
      planningDrafts: "id, createdAt, updatedAt",
      statusHistory:
        "id, entityId, entityKind, status, workieDay, [entityId+status+workieDay], createdAt, updatedAt",
      pomodoroCycles: "id, createdAt, updatedAt",
      sessions: "id, createdAt, updatedAt",
      segments: "id, createdAt, updatedAt",
      importReviewDrafts: "id, createdAt, updatedAt",
    });
    this.version(4).stores({
      settings: "id, createdAt, updatedAt",
    });
    this.version(5).stores({
      blocks: "id, day, taskId, createdAt, updatedAt",
    });
  }
}
