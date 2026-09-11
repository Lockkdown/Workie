import { WorkieDB } from "./schema";

export async function commitAtomic<T>(
  db: WorkieDB,
  work: () => Promise<T>,
): Promise<T> {
  return db.transaction(
    "readwrite",
    [
      db.tasks,
      db.occurrences,
      db.blocks,
      db.planningDrafts,
      db.statusHistory,
      db.pomodoroCycles,
      db.sessions,
      db.segments,
      db.importReviewDrafts,
    ],
    work,
  );
}
