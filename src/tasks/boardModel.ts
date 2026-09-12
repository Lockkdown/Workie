import {
  cardSignals,
  type BlockSignal,
  type CardSignals,
} from "../domain/cardSignals";
import { lastClosingTime } from "../domain/statusHistory";
import { moveLiveStatus, reorderLive } from "../domain/transitions";
import type {
  KanbanColumn,
  LiveStatus,
  Occurrence,
  StatusEntity,
  StatusHistoryEvent,
  Task,
  TaskSource,
  TaskStatus,
} from "../domain/types";
import { isClosedStatus, isLiveStatus, kanbanColumn } from "../domain/types";
import { workieDayKey } from "../domain/workieDay";
import { COPY } from "./copy";

export type BoardItem = {
  entity: StatusEntity;
  task: Task;
};

export type ClosedGroup = {
  status: "Completed" | "Abandoned" | "Cancelled";
  items: BoardItem[];
};

export type BoardColumns = {
  Waiting: BoardItem[];
  "In Progress": BoardItem[];
  Deferred: BoardItem[];
  Closed: ClosedGroup[];
};

export type DropIntent = "reorder" | "move-live" | "ignored";

export function sourceLabel(source: TaskSource): string {
  if (source.kind === "user") {
    return source.accountId;
  }
  return source.sourceName;
}

export function scheduleTaskId(item: BoardItem): string {
  return item.task.id;
}

export function closingSortKey(
  entity: StatusEntity,
  history: readonly StatusHistoryEvent[],
): number {
  const at = lastClosingTime(entity.id, history);
  return at > 0 ? at : entity.updatedAt;
}

export function sortLive(items: readonly BoardItem[]): BoardItem[] {
  return [...items].sort((a, b) => {
    const ao = a.entity.liveOrder ?? a.entity.createdAt;
    const bo = b.entity.liveOrder ?? b.entity.createdAt;
    if (ao !== bo) {
      return ao - bo;
    }
    return a.entity.id.localeCompare(b.entity.id);
  });
}

export function sortClosed(
  items: readonly BoardItem[],
  history: readonly StatusHistoryEvent[],
): BoardItem[] {
  return [...items].sort((a, b) => {
    const byTime =
      closingSortKey(b.entity, history) - closingSortKey(a.entity, history);
    if (byTime !== 0) {
      return byTime;
    }
    return a.entity.id.localeCompare(b.entity.id);
  });
}

export function selectBoardItems(
  tasks: readonly Task[],
  occurrences: readonly Occurrence[],
  now: number,
): BoardItem[] {
  const today = workieDayKey(now);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const items: BoardItem[] = [];
  for (const task of tasks) {
    items.push({ entity: task, task });
  }
  for (const occurrence of occurrences) {
    if (occurrence.date !== today) {
      continue;
    }
    const parent = byId.get(occurrence.taskId);
    if (parent === undefined) {
      continue;
    }
    items.push({ entity: occurrence, task: parent });
  }
  return items;
}

export function groupBoard(
  items: readonly BoardItem[],
  history: readonly StatusHistoryEvent[],
): BoardColumns {
  const waiting: BoardItem[] = [];
  const inProgress: BoardItem[] = [];
  const deferred: BoardItem[] = [];
  const completed: BoardItem[] = [];
  const abandoned: BoardItem[] = [];
  const cancelled: BoardItem[] = [];
  for (const item of items) {
    switch (item.entity.status) {
      case "Waiting":
        waiting.push(item);
        break;
      case "In Progress":
        inProgress.push(item);
        break;
      case "Deferred":
        deferred.push(item);
        break;
      case "Completed":
        completed.push(item);
        break;
      case "Abandoned":
        abandoned.push(item);
        break;
      case "Cancelled":
        cancelled.push(item);
        break;
    }
  }
  return {
    Waiting: sortLive(waiting),
    "In Progress": sortLive(inProgress),
    Deferred: sortLive(deferred),
    Closed: [
      { status: "Completed", items: sortClosed(completed, history) },
      { status: "Abandoned", items: sortClosed(abandoned, history) },
      { status: "Cancelled", items: sortClosed(cancelled, history) },
    ],
  };
}

export function dropIntent(
  fromStatus: TaskStatus,
  toColumn: KanbanColumn,
): DropIntent {
  if (toColumn === "Closed" || isClosedStatus(fromStatus)) {
    return "ignored";
  }
  if (kanbanColumn(fromStatus) === toColumn) {
    return "reorder";
  }
  return "move-live";
}

export function findItem(
  items: readonly BoardItem[],
  entityId: string,
): BoardItem | undefined {
  return items.find((item) => item.entity.id === entityId);
}

function replaceEntity(items: BoardItem[], entity: StatusEntity): BoardItem[] {
  return items.map((item) => {
    if (item.entity.id === entity.id) {
      return {
        entity,
        task: entity.kind === "task" ? entity : item.task,
      };
    }
    if (entity.kind === "task" && item.task.id === entity.id) {
      return { ...item, task: entity };
    }
    return item;
  });
}

function assignLiveOrder(
  items: BoardItem[],
  columnItems: BoardItem[],
  now: number,
): BoardItem[] {
  let next = items;
  columnItems.forEach((item, index) => {
    if (!isLiveStatus(item.entity.status)) {
      return;
    }
    const updated = reorderLive(item.entity, index, now);
    next = replaceEntity(next, updated);
  });
  return next;
}

export function applyLiveDrop(input: {
  items: readonly BoardItem[];
  history: readonly StatusHistoryEvent[];
  entityId: string;
  toColumn: LiveStatus;
  toIndex: number;
  now: number;
}):
  | {
      intent: "reorder" | "move-live";
      items: BoardItem[];
      history: StatusHistoryEvent[];
    }
  | { intent: "ignored" } {
  const current = findItem(input.items, input.entityId);
  if (current === undefined) {
    return { intent: "ignored" };
  }
  const intent = dropIntent(current.entity.status, input.toColumn);
  if (intent === "ignored") {
    return { intent: "ignored" };
  }

  let history = input.history.map((event) => ({ ...event }));
  let entity = current.entity;
  if (intent === "move-live") {
    const moved = moveLiveStatus(entity, input.toColumn, input.now, history);
    entity = moved.entity;
    history = moved.history;
  }

  let items = replaceEntity([...input.items], entity);
  const fromColumn = kanbanColumn(current.entity.status);
  const dest = items.filter((item) => item.entity.status === input.toColumn);
  const without = dest.filter((item) => item.entity.id !== entity.id);
  const index = Math.max(0, Math.min(input.toIndex, without.length));
  const nextDest = [
    ...without.slice(0, index),
    findItem(items, entity.id) ?? { entity, task: current.task },
    ...without.slice(index),
  ];
  items = assignLiveOrder(items, nextDest, input.now);
  if (intent === "move-live" && fromColumn !== input.toColumn) {
    const source = items.filter(
      (item) =>
        isLiveStatus(item.entity.status) && item.entity.status === fromColumn,
    );
    items = assignLiveOrder(items, source, input.now);
  }
  return { intent, items, history };
}

export function applyMoveRelative(input: {
  items: readonly BoardItem[];
  entityId: string;
  direction: -1 | 1;
  now: number;
}): BoardItem[] | undefined {
  const current = findItem(input.items, input.entityId);
  if (current === undefined || !isLiveStatus(current.entity.status)) {
    return undefined;
  }
  const column = sortLive(
    input.items.filter((item) => item.entity.status === current.entity.status),
  );
  const index = column.findIndex((item) => item.entity.id === input.entityId);
  const swapWith = index + input.direction;
  if (index < 0 || swapWith < 0 || swapWith >= column.length) {
    return undefined;
  }
  const nextColumn = [...column];
  const currentItem = nextColumn[index];
  const otherItem = nextColumn[swapWith];
  if (currentItem === undefined || otherItem === undefined) {
    return undefined;
  }
  nextColumn[index] = otherItem;
  nextColumn[swapWith] = currentItem;
  return assignLiveOrder([...input.items], nextColumn, input.now);
}

export function applyMoveToLive(input: {
  items: readonly BoardItem[];
  history: readonly StatusHistoryEvent[];
  entityId: string;
  to: LiveStatus;
  now: number;
}):
  | { items: BoardItem[]; history: StatusHistoryEvent[] }
  | { intent: "ignored" } {
  const current = findItem(input.items, input.entityId);
  if (current === undefined || !isLiveStatus(current.entity.status)) {
    return { intent: "ignored" };
  }
  if (current.entity.status === input.to) {
    return { intent: "ignored" };
  }
  const destLen = input.items.filter(
    (item) => item.entity.status === input.to,
  ).length;
  const dropped = applyLiveDrop({
    items: input.items,
    history: input.history,
    entityId: input.entityId,
    toColumn: input.to,
    toIndex: destLen,
    now: input.now,
  });
  if (dropped.intent === "ignored") {
    return { intent: "ignored" };
  }
  return { items: dropped.items, history: dropped.history };
}

export function signalsFor(
  item: BoardItem,
  blocks: readonly BlockSignal[],
  now: number,
  history: readonly StatusHistoryEvent[],
): CardSignals {
  return cardSignals({
    task: item.task,
    occurrence: item.entity.kind === "occurrence" ? item.entity : undefined,
    blocks,
    now,
    history,
  });
}

export function formatNearestBlock(
  nearest: CardSignals["nearestBlock"],
): string {
  if (nearest === "Unscheduled") {
    return COPY.unscheduled;
  }
  if (
    !Number.isFinite(nearest.startsAt) ||
    nearest.startsAt < 1_000_000_000_000
  ) {
    return COPY.scheduled;
  }
  const date = new Date(nearest.startsAt);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${workieDayKey(nearest.startsAt)} ${hh}:${mm}`;
}

export function weekdayNames(weekdays: readonly number[]): string {
  if (weekdays.length === 7) {
    return COPY.daily;
  }
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekdays.map((day) => labels[day] ?? String(day)).join(", ");
}

export function collectChangedEntities(
  previous: readonly BoardItem[],
  next: readonly BoardItem[],
): StatusEntity[] {
  const before = new Map(previous.map((item) => [item.entity.id, item.entity]));
  const changed: StatusEntity[] = [];
  for (const item of next) {
    const old = before.get(item.entity.id);
    if (old === undefined || old !== item.entity) {
      changed.push(item.entity);
    }
  }
  return changed;
}
