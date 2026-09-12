import { commitAtomic } from "../db/atomicCommit";
import type { WorkieDB } from "../db/schema";
import type { TaskGraph } from "../db/taskPersistence";
import { createTask } from "../domain/taskModel";
import type { StatusHistoryEvent, Subtask, Task } from "../domain/types";
import { ACTIVE_DRAFT_ID, type ReviewSession } from "./types";
import { validateSelected } from "./reviewState";

export class ImportCommitError extends Error {
  itemKey?: string;

  constructor(message: string, itemKey?: string) {
    super(message);
    this.name = "ImportCommitError";
    this.itemKey = itemKey;
  }
}

export type PreparedImport = {
  draftId: string;
  graph: TaskGraph;
  itemKeys: string[];
};

export type PrepareResult =
  | { ok: true; prepared: PreparedImport }
  | { ok: false; error: string; itemKey?: string };

function toSubtasks(
  titles: readonly { title: string }[],
  newId: () => string,
): Subtask[] {
  return titles
    .map((item) => item.title.trim())
    .filter((title) => title.length > 0)
    .map((title) => ({ id: newId(), title, done: false }));
}

export function prepareImportBatch(
  session: ReviewSession,
  options: { now: number; newId: () => string },
): PrepareResult {
  const valid = validateSelected(session);
  if (!valid.ok) {
    return valid;
  }
  const selected = [...session.items]
    .filter((item) => item.selected)
    .sort((a, b) => a.order - b.order);
  const tasks: Task[] = [];
  const statusHistory: StatusHistoryEvent[] = [];
  const itemKeys: string[] = [];
  for (const item of selected) {
    try {
      const seeded = createTask({
        id: options.newId(),
        title: item.title,
        description: item.description,
        now: options.now,
        source: {
          kind: "ai",
          sourceName: session.sourceName,
          sourceMark: session.sourceMark,
          itemKey: item.itemKey,
        },
        subtasks: toSubtasks(item.subtasks, options.newId),
      });
      tasks.push({ ...seeded.task, liveOrder: item.order });
      statusHistory.push(...seeded.history);
      itemKeys.push(item.itemKey);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return {
        ok: false,
        error: `Task ${item.itemKey}: ${message}`,
        itemKey: item.itemKey,
      };
    }
  }
  return {
    ok: true,
    prepared: {
      draftId: ACTIVE_DRAFT_ID,
      graph: { tasks, statusHistory },
      itemKeys,
    },
  };
}

/**
 * One readwrite transaction: task/history puts matching persistTaskGraph,
 * then delete the review draft [D63] [D96] [D101].
 */
export async function commitImportBatch(
  db: WorkieDB,
  prepared: PreparedImport,
  options?: { throwAfter?: number },
): Promise<void> {
  await commitAtomic(db, async () => {
    let puts = 0;
    const tasks = prepared.graph.tasks ?? [];
    for (const [index, task] of tasks.entries()) {
      try {
        await db.tasks.put(task);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new ImportCommitError(
          `Task ${prepared.itemKeys[index] ?? task.id}: ${message}`,
          prepared.itemKeys[index],
        );
      }
      puts += 1;
      if (options?.throwAfter !== undefined && puts >= options.throwAfter) {
        throw new Error("forced-import-error");
      }
    }
    for (const occurrence of prepared.graph.occurrences ?? []) {
      await db.occurrences.put(occurrence);
    }
    for (const event of prepared.graph.statusHistory ?? []) {
      const existing = await db.statusHistory.get(event.id);
      if (existing === undefined) {
        await db.statusHistory.add(event);
      }
    }
    await db.importReviewDrafts.delete(prepared.draftId);
  });
}

export function commitErrorMessage(cause: unknown): string {
  if (cause instanceof ImportCommitError) {
    return cause.message;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}
