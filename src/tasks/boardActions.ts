import {
  persistNewTask,
  persistStatusChange,
  persistTaskGraph,
} from "../db/taskPersistence";
import type { WorkieDB } from "../db/schema";
import { localUserSource } from "../desk/boardContract";
import { abandon, cancel, complete, restore } from "../domain/transitions";
import type {
  Occurrence,
  StatusEntity,
  StatusHistoryEvent,
  Subtask,
  Task,
  Weekday,
} from "../domain/types";
import { newId } from "../id";
import type { BoardItem } from "./boardModel";
import { collectChangedEntities } from "./boardModel";

export type CreateTaskFields = {
  title: string;
  description?: string;
  subtasks?: readonly { title: string }[];
  repeatWeekdays?: readonly Weekday[];
  id?: string;
  now?: number;
};

function splitEntities(entities: readonly StatusEntity[]): {
  tasks: Task[];
  occurrences: Occurrence[];
} {
  const tasks: Task[] = [];
  const occurrences: Occurrence[] = [];
  for (const entity of entities) {
    if (entity.kind === "task") {
      tasks.push(entity);
    } else {
      occurrences.push(entity);
    }
  }
  return { tasks, occurrences };
}

export async function persistCreatedTask(
  db: WorkieDB,
  fields: CreateTaskFields,
): Promise<{ task: Task; history: StatusHistoryEvent[] }> {
  const subtasks: Subtask[] = (fields.subtasks ?? [])
    .map((item) => item.title.trim())
    .filter((title) => title.length > 0)
    .map((title) => ({
      id: newId(),
      title,
      done: false,
    }));
  return persistNewTask(db, {
    title: fields.title,
    description:
      fields.description !== undefined && fields.description.length > 0
        ? fields.description
        : undefined,
    subtasks,
    repeatWeekdays: fields.repeatWeekdays,
    source: localUserSource(),
    id: fields.id,
    now: fields.now,
  });
}

export async function persistCompleteEntity(
  db: WorkieDB,
  entity: StatusEntity,
  history: readonly StatusHistoryEvent[],
  now: number,
): Promise<{ entity: StatusEntity; history: StatusHistoryEvent[] }> {
  const result = complete(entity, now, history);
  await persistStatusChange(db, result.entity, result.history);
  return result;
}

export async function persistAbandonEntity(
  db: WorkieDB,
  entity: StatusEntity,
  history: readonly StatusHistoryEvent[],
  now: number,
): Promise<{ entity: StatusEntity; history: StatusHistoryEvent[] }> {
  const result = abandon(entity, { confirmed: true }, now, history);
  await persistStatusChange(db, result.entity, result.history);
  return result;
}

export async function persistCancelEntity(
  db: WorkieDB,
  entity: StatusEntity,
  history: readonly StatusHistoryEvent[],
  now: number,
): Promise<{ entity: StatusEntity; history: StatusHistoryEvent[] }> {
  const result = cancel(entity, { confirmed: true }, now, history);
  await persistStatusChange(db, result.entity, result.history);
  return result;
}

export async function persistRestoreEntity(
  db: WorkieDB,
  entity: StatusEntity,
  history: readonly StatusHistoryEvent[],
  now: number,
): Promise<{ entity: StatusEntity; history: StatusHistoryEvent[] }> {
  const result = restore(entity, now, history);
  await persistStatusChange(db, result.entity, result.history);
  return result;
}

export async function persistBoardItems(
  db: WorkieDB,
  previous: readonly BoardItem[],
  next: readonly BoardItem[],
  history?: readonly StatusHistoryEvent[],
): Promise<void> {
  const changed = collectChangedEntities(previous, next);
  const { tasks, occurrences } = splitEntities(changed);
  await persistTaskGraph(db, {
    tasks,
    occurrences,
    statusHistory: history,
  });
}

export function notifyScheduleTask(
  onScheduleTask: (taskId: string) => void,
  taskId: string,
): void {
  onScheduleTask(taskId);
}

export function statusUnchangedMessage(cause: string): string {
  return `${cause} The task was not changed.`;
}
