import {
  addLocalDays,
  startOfWeekMonday,
  startOfWorkieDay,
  workieDayKey,
} from "../domain/workieDay";
import type { Period, PeriodKind } from "./types";

export function periodContaining(kind: PeriodKind, now: number): Period {
  if (kind === "Day") {
    const startMs = startOfWorkieDay(now);
    return { kind, startMs, endMs: addLocalDays(startMs, 1) };
  }
  if (kind === "Week") {
    const startMs = startOfWeekMonday(now);
    return { kind, startMs, endMs: addLocalDays(startMs, 7) };
  }
  if (kind === "Month") {
    const d = new Date(now);
    const startMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const endMs = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    return { kind, startMs, endMs };
  }
  const d = new Date(now);
  const startMs = new Date(d.getFullYear(), 0, 1).getTime();
  const endMs = new Date(d.getFullYear() + 1, 0, 1).getTime();
  return { kind, startMs, endMs };
}

export function shiftPeriod(period: Period, direction: -1 | 1): Period {
  if (period.kind === "Day") {
    return periodContaining("Day", addLocalDays(period.startMs, direction));
  }
  if (period.kind === "Week") {
    return periodContaining(
      "Week",
      addLocalDays(period.startMs, direction * 7),
    );
  }
  if (period.kind === "Month") {
    const d = new Date(period.startMs);
    return periodContaining(
      "Month",
      new Date(d.getFullYear(), d.getMonth() + direction, 1).getTime(),
    );
  }
  const d = new Date(period.startMs);
  return periodContaining(
    "Year",
    new Date(d.getFullYear() + direction, 0, 1).getTime(),
  );
}

export function daysInPeriod(period: Period): string[] {
  const days: string[] = [];
  let cursor = period.startMs;
  while (cursor < period.endMs) {
    days.push(workieDayKey(cursor));
    cursor = addLocalDays(cursor, 1);
  }
  return days;
}

export function contributionYear(year: number): Period {
  const startMs = new Date(year, 0, 1).getTime();
  const endMs = new Date(year + 1, 0, 1).getTime();
  return { kind: "Year", startMs, endMs };
}

export function yearOf(ms: number): number {
  return new Date(ms).getFullYear();
}
