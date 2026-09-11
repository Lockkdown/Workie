import type { Weekday } from "./types";

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Workie day id: local calendar date `YYYY-MM-DD` [D31]. */
export function workieDayKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function startOfWorkieDay(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addLocalDays(epochMs: number, days: number): number {
  const d = new Date(epochMs);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function parseWorkieDayStart(day: string): number {
  const match = DAY_KEY.exec(day);
  if (!match) {
    throw new Error(`Invalid Workie day ${day} [D31]`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  return new Date(year, month - 1, date).getTime();
}

export function isWorkieDayKey(value: string): boolean {
  return DAY_KEY.test(value);
}

export function weekdayAt(epochMs: number): Weekday {
  return new Date(epochMs).getDay() as Weekday;
}

export function weekdayOfDay(day: string): Weekday {
  return weekdayAt(parseWorkieDayStart(day));
}

export function tomorrowWorkieDay(now: number): string {
  return workieDayKey(addLocalDays(startOfWorkieDay(now), 1));
}

/**
 * Workie days strictly after `lastOpen`'s day, through `now`'s day inclusive.
 * That span is the closed-day gap used by back-fill [D13].
 */
export function missedWorkieDays(lastOpen: number, now: number): string[] {
  if (!Number.isFinite(lastOpen) || !Number.isFinite(now) || now < lastOpen) {
    return [];
  }
  const days: string[] = [];
  let cursor = addLocalDays(startOfWorkieDay(lastOpen), 1);
  const end = startOfWorkieDay(now);
  while (cursor <= end) {
    days.push(workieDayKey(cursor));
    cursor = addLocalDays(cursor, 1);
  }
  return days;
}

/** Week is 00:00 Monday to before 00:00 the next Monday, local time [D57]. */
export function startOfWeekMonday(epochMs: number): number {
  const start = new Date(startOfWorkieDay(epochMs));
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  return start.getTime();
}
