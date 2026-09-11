import Dexie, { type Table } from "dexie";

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
  tasks!: Table<ScaffoldRecord, string>;
  occurrences!: Table<ScaffoldRecord, string>;
  blocks!: Table<ScaffoldRecord, string>;
  planningDrafts!: Table<ScaffoldRecord, string>;
  statusHistory!: Table<ScaffoldRecord, string>;
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
  }
}
