import { recordStatusEvent } from "./statusHistory";
import type {
  CreateOccurrenceInput,
  CreateTaskInput,
  Occurrence,
  StatusHistoryEvent,
  Subtask,
  Task,
  TaskSource,
  Weekday,
} from "./types";
import {
  addLocalDays,
  isWorkieDayKey,
  startOfWeekMonday,
  workieDayKey,
} from "./workieDay";

export type TimeGrouping = "Today" | "This week" | "Unscheduled" | "Other";

export function parseRepeatWeekdays(input: readonly number[]): Weekday[] {
  if (input.length === 0) {
    throw new Error(
      "Repeat rule is a weekday set only; empty is one-off [D13]",
    );
  }
  const unique = new Set<Weekday>();
  for (const day of input) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new Error("Repeat rule is a weekday set only (0–6) [D13]");
    }
    unique.add(day as Weekday);
  }
  return [...unique].sort((a, b) => a - b);
}

export function isDailyRepeat(weekdays: readonly Weekday[]): boolean {
  return new Set(weekdays).size === 7;
}

function copySubtasks(subtasks: readonly Subtask[]): Subtask[] {
  return subtasks.map((item) => ({ ...item }));
}

function assertTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error("Title is required [D17]");
  }
  return trimmed;
}

function assertSource(source: TaskSource): TaskSource {
  if (source.kind === "user") {
    if (source.accountId.trim().length === 0) {
      throw new Error("User source requires an account id [D8]");
    }
    return { kind: "user", accountId: source.accountId };
  }
  if (source.kind === "ai") {
    if (source.sourceName.trim().length === 0) {
      throw new Error("AI source requires a source name [D8]");
    }
    return {
      kind: "ai",
      sourceName: source.sourceName,
      sourceMark: source.sourceMark,
      itemKey: source.itemKey,
    };
  }
  throw new Error("Every task stores source / creator [D8]");
}

export function createTask(input: CreateTaskInput): {
  task: Task;
  history: StatusHistoryEvent[];
} {
  const title = assertTitle(input.title);
  const source = assertSource(input.source);
  const task: Task = {
    kind: "task",
    id: input.id,
    title,
    subtasks: copySubtasks(input.subtasks ?? []),
    status: "Waiting",
    source,
    createdAt: input.now,
    updatedAt: input.now,
    blockIds: [],
    focusHistory: [],
  };
  if (input.description !== undefined) {
    task.description = input.description;
  }
  if (input.repeatWeekdays !== undefined) {
    task.repeatWeekdays = parseRepeatWeekdays(input.repeatWeekdays);
  }
  const history = recordStatusEvent([], {
    entityId: task.id,
    entityKind: "task",
    status: "Waiting",
    now: input.now,
  });
  return { task, history };
}

export function createOccurrence(input: CreateOccurrenceInput): {
  occurrence: Occurrence;
  history: StatusHistoryEvent[];
} {
  if (!isWorkieDayKey(input.date)) {
    throw new Error(
      `Occurrence date must be a Workie day [D13]: ${input.date}`,
    );
  }
  const occurrence: Occurrence = {
    kind: "occurrence",
    id: input.id,
    taskId: input.taskId,
    date: input.date,
    status: "Waiting",
    createdAt: input.now,
    updatedAt: input.now,
    blockIds: [],
    focusHistory: [],
  };
  const history = recordStatusEvent([], {
    entityId: occurrence.id,
    entityKind: "occurrence",
    status: "Waiting",
    now: input.now,
  });
  return { occurrence, history };
}

export function hasBlocks(entity: { blockIds: readonly string[] }): boolean {
  return entity.blockIds.length > 0;
}

/** Scheduled state is derived from blocks, never stored as a status [D5] [D11]. */
export function isScheduled(entity: { blockIds: readonly string[] }): boolean {
  return hasBlocks(entity);
}

export function setBlockIds<
  E extends { blockIds: string[]; updatedAt: number },
>(entity: E, blockIds: readonly string[], now: number): E {
  return {
    ...entity,
    blockIds: [...blockIds],
    updatedAt: now,
  };
}

/**
 * Time grouping is derived from the plan, never a stored status [D5].
 * "This week" uses Monday–Sunday local bounds [D57].
 */
export function deriveTimeGrouping(
  blockStartTimes: readonly number[],
  now: number,
): TimeGrouping {
  if (blockStartTimes.length === 0) {
    return "Unscheduled";
  }
  const today = workieDayKey(now);
  for (const start of blockStartTimes) {
    if (workieDayKey(start) === today) {
      return "Today";
    }
  }
  const weekStart = startOfWeekMonday(now);
  const weekEnd = addLocalDays(weekStart, 7);
  for (const start of blockStartTimes) {
    if (start >= weekStart && start < weekEnd) {
      return "This week";
    }
  }
  return "Other";
}
