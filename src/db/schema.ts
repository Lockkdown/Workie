import Dexie, { type Table } from "dexie";
import type { Occurrence, StatusHistoryEvent, Task } from "../domain/types";

export type ScaffoldRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
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
  blocks!: Table<ScaffoldRecord, string>;
  planningDrafts!: Table<ScaffoldRecord, string>;
  statusHistory!: Table<StatusHistoryEvent, string>;
  pomodoroCycles!: Table<ScaffoldRecord, string>;
  sessions!: Table<ScaffoldRecord, string>;
  segments!: Table<ScaffoldRecord, string>;
  importReviewDrafts!: Table<ScaffoldRecord, string>;

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
  }
}
