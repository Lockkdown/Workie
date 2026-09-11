import { createOccurrence } from "./taskModel";
import type { Occurrence, StatusHistoryEvent, Task, Weekday } from "./types";
import {
  missedWorkieDays,
  tomorrowWorkieDay,
  weekdayOfDay,
  workieDayKey,
} from "./workieDay";

export type SeededOccurrence = {
  occurrence: Occurrence;
  history: StatusHistoryEvent[];
};

function occurrenceKey(taskId: string, date: string): string {
  return `${taskId}|${date}`;
}

function ruleMatches(task: Task, date: string): boolean {
  const weekdays = task.repeatWeekdays;
  if (weekdays === undefined || weekdays.length === 0) {
    return false;
  }
  const weekday: Weekday = weekdayOfDay(date);
  return weekdays.includes(weekday);
}

function taskExistedOn(task: Task, date: string): boolean {
  return workieDayKey(task.createdAt) <= date;
}

function trySeed(
  task: Task,
  date: string,
  existing: Set<string>,
  newId: () => string,
  now: number,
): SeededOccurrence | undefined {
  if (!ruleMatches(task, date) || !taskExistedOn(task, date)) {
    return undefined;
  }
  const key = occurrenceKey(task.id, date);
  if (existing.has(key)) {
    return undefined;
  }
  existing.add(key);
  return createOccurrence({
    id: newId(),
    taskId: task.id,
    date,
    now,
  });
}

/** Opening Plan Tomorrow creates tomorrow's occurrence exactly once [D13]. */
export function ensureTomorrowOccurrences(input: {
  now: number;
  tasks: readonly Task[];
  occurrences: readonly Occurrence[];
  newId: () => string;
}): SeededOccurrence[] {
  const date = tomorrowWorkieDay(input.now);
  const existing = new Set(
    input.occurrences.map((item) => occurrenceKey(item.taskId, item.date)),
  );
  const created: SeededOccurrence[] = [];
  for (const task of input.tasks) {
    const seeded = trySeed(task, date, existing, input.newId, input.now);
    if (seeded) {
      created.push(seeded);
    }
  }
  return created;
}

/**
 * On app open, back-fill every missed due occurrence without duplicates.
 * No cap or roll-up [D13].
 */
export function backfillMissedOccurrences(input: {
  now: number;
  lastOpen: number;
  tasks: readonly Task[];
  occurrences: readonly Occurrence[];
  newId: () => string;
}): SeededOccurrence[] {
  const existing = new Set(
    input.occurrences.map((item) => occurrenceKey(item.taskId, item.date)),
  );
  const created: SeededOccurrence[] = [];
  for (const date of missedWorkieDays(input.lastOpen, input.now)) {
    for (const task of input.tasks) {
      const seeded = trySeed(task, date, existing, input.newId, input.now);
      if (seeded) {
        created.push(seeded);
      }
    }
  }
  return created;
}
