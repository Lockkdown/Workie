import { commitAtomic } from "./atomicCommit";
import { WorkieDB } from "./schema";
import {
  backfillMissedOccurrences,
  ensureTomorrowOccurrences,
} from "../domain/recurrence";
import { createTask } from "../domain/taskModel";
import type {
  CreateTaskInput,
  Occurrence,
  StatusHistoryEvent,
  Task,
} from "../domain/types";

export type TaskGraph = {
  tasks?: readonly Task[];
  occurrences?: readonly Occurrence[];
  statusHistory?: readonly StatusHistoryEvent[];
};

/** Atomic multi-record write for domain data and T11 [D63] [D96]. */
export async function persistTaskGraph(
  db: WorkieDB,
  graph: TaskGraph,
): Promise<void> {
  await commitAtomic(db, async () => {
    for (const task of graph.tasks ?? []) {
      await db.tasks.put(task);
    }
    for (const occurrence of graph.occurrences ?? []) {
      await db.occurrences.put(occurrence);
    }
    for (const event of graph.statusHistory ?? []) {
      const existing = await db.statusHistory.get(event.id);
      if (existing === undefined) {
        await db.statusHistory.add(event);
      }
    }
  });
}

export async function persistNewTask(
  db: WorkieDB,
  input: Omit<CreateTaskInput, "id" | "now"> & {
    id?: string;
    now?: number;
  },
): Promise<{ task: Task; history: StatusHistoryEvent[] }> {
  const seeded = createTask({
    ...input,
    id: input.id ?? crypto.randomUUID(),
    now: input.now ?? Date.now(),
  });
  await persistTaskGraph(db, {
    tasks: [seeded.task],
    statusHistory: seeded.history,
  });
  return seeded;
}

export async function persistStatusChange(
  db: WorkieDB,
  entity: Task | Occurrence,
  history: readonly StatusHistoryEvent[],
): Promise<void> {
  if (entity.kind === "task") {
    await persistTaskGraph(db, { tasks: [entity], statusHistory: history });
    return;
  }
  await persistTaskGraph(db, {
    occurrences: [entity],
    statusHistory: history,
  });
}

export async function loadTaskState(db: WorkieDB): Promise<{
  tasks: Task[];
  occurrences: Occurrence[];
  statusHistory: StatusHistoryEvent[];
}> {
  return {
    tasks: await db.tasks.toArray(),
    occurrences: await db.occurrences.toArray(),
    statusHistory: await db.statusHistory.toArray(),
  };
}

export async function persistEnsureTomorrowOccurrences(
  db: WorkieDB,
  now: number,
): Promise<Occurrence[]> {
  const tasks = await db.tasks.toArray();
  const occurrences = await db.occurrences.toArray();
  const seeded = ensureTomorrowOccurrences({
    now,
    tasks,
    occurrences,
    newId: () => crypto.randomUUID(),
  });
  if (seeded.length === 0) {
    return [];
  }
  await persistTaskGraph(db, {
    occurrences: seeded.map((item) => item.occurrence),
    statusHistory: seeded.flatMap((item) => item.history),
  });
  return seeded.map((item) => item.occurrence);
}

export async function persistBackfillMissedOccurrences(
  db: WorkieDB,
  now: number,
  lastOpen: number,
): Promise<Occurrence[]> {
  const tasks = await db.tasks.toArray();
  const occurrences = await db.occurrences.toArray();
  const seeded = backfillMissedOccurrences({
    now,
    lastOpen,
    tasks,
    occurrences,
    newId: () => crypto.randomUUID(),
  });
  if (seeded.length === 0) {
    return [];
  }
  await persistTaskGraph(db, {
    occurrences: seeded.map((item) => item.occurrence),
    statusHistory: seeded.flatMap((item) => item.history),
  });
  return seeded.map((item) => item.occurrence);
}
