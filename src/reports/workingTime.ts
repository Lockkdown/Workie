import type { PomodoroCycle } from "../pomodoro/types";
import {
  addLocalDays,
  startOfWorkieDay,
  workieDayKey,
} from "../domain/workieDay";
import type { Period } from "./types";
import type { Bar, DiscardedTrace, TaskRow, WorkingTimeReport } from "./types";

export type FocusSlice = {
  taskId: string;
  startMs: number;
  endMs: number;
};

function countedSlices(cycles: readonly PomodoroCycle[]): FocusSlice[] {
  const slices: FocusSlice[] = [];
  for (const cycle of cycles) {
    if (
      cycle.outcome !== "Timer complete" &&
      cycle.outcome !== "Stopped early"
    ) {
      continue;
    }
    for (const session of cycle.sessions) {
      for (const segment of session.segments) {
        if (segment.endedAt === null || segment.endedAt <= segment.startedAt) {
          continue;
        }
        slices.push({
          taskId: session.taskId,
          startMs: segment.startedAt,
          endMs: segment.endedAt,
        });
      }
    }
  }
  return slices;
}

function clip(
  startMs: number,
  endMs: number,
  period: Period,
): FocusSlice | null {
  const start = Math.max(startMs, period.startMs);
  const end = Math.min(endMs, period.endMs);
  if (end <= start) {
    return null;
  }
  return { taskId: "", startMs: start, endMs: end };
}

function hourStart(ms: number): number {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function nextHour(ms: number): number {
  const d = new Date(hourStart(ms));
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

function monthStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function nextMonth(ms: number): number {
  const d = new Date(monthStart(ms));
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

function splitRange(
  startMs: number,
  endMs: number,
  bucketStart: (ms: number) => number,
  nextBucket: (ms: number) => number,
  label: (start: number) => { key: string; label: string },
): Bar[] {
  const bars: Bar[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const start = bucketStart(cursor);
    const end = Math.min(nextBucket(start), endMs);
    const from = Math.max(cursor, start);
    if (end > from) {
      const named = label(start);
      bars.push({ key: named.key, label: named.label, ms: end - from });
    }
    cursor = end;
  }
  return bars;
}

function mergeBars(parts: Bar[]): Bar[] {
  const map = new Map<string, Bar>();
  for (const bar of parts) {
    const existing = map.get(bar.key);
    if (existing) {
      existing.ms += bar.ms;
    } else {
      map.set(bar.key, { ...bar });
    }
  }
  return [...map.values()];
}

function emptyHourBars(period: Period): Bar[] {
  const bars: Bar[] = [];
  let cursor = period.startMs;
  while (cursor < period.endMs) {
    const hour = new Date(cursor).getHours();
    bars.push({
      key: String(hour),
      label: `${String(hour).padStart(2, "0")}:00`,
      ms: 0,
    });
    cursor = nextHour(cursor);
  }
  return bars;
}

function emptyDayBars(period: Period): Bar[] {
  const bars: Bar[] = [];
  let cursor = period.startMs;
  while (cursor < period.endMs) {
    const day = workieDayKey(cursor);
    bars.push({ key: day, label: day, ms: 0 });
    cursor = addLocalDays(cursor, 1);
  }
  return bars;
}

function emptyMonthBars(period: Period): Bar[] {
  const bars: Bar[] = [];
  let cursor = period.startMs;
  while (cursor < period.endMs) {
    const d = new Date(cursor);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    bars.push({ key, label: key, ms: 0 });
    cursor = nextMonth(cursor);
  }
  return bars;
}

function fillTemplate(template: Bar[], filled: Bar[]): Bar[] {
  const byKey = new Map(filled.map((bar) => [bar.key, bar.ms]));
  return template.map((bar) => ({
    ...bar,
    ms: byKey.get(bar.key) ?? 0,
  }));
}

export function bucketBars(
  slices: readonly FocusSlice[],
  period: Period,
): Bar[] {
  const parts: Bar[] = [];
  for (const slice of slices) {
    const clipped = clip(slice.startMs, slice.endMs, period);
    if (!clipped) {
      continue;
    }
    if (period.kind === "Day") {
      parts.push(
        ...splitRange(
          clipped.startMs,
          clipped.endMs,
          hourStart,
          nextHour,
          (start) => {
            const hour = new Date(start).getHours();
            return {
              key: String(hour),
              label: `${String(hour).padStart(2, "0")}:00`,
            };
          },
        ),
      );
    } else if (period.kind === "Year") {
      parts.push(
        ...splitRange(
          clipped.startMs,
          clipped.endMs,
          monthStart,
          nextMonth,
          (start) => {
            const d = new Date(start);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            return { key, label: key };
          },
        ),
      );
    } else {
      parts.push(
        ...splitRange(
          clipped.startMs,
          clipped.endMs,
          startOfWorkieDay,
          (ms) => addLocalDays(startOfWorkieDay(ms), 1),
          (start) => {
            const day = workieDayKey(start);
            return { key: day, label: day };
          },
        ),
      );
    }
  }
  const template =
    period.kind === "Day"
      ? emptyHourBars(period)
      : period.kind === "Year"
        ? emptyMonthBars(period)
        : emptyDayBars(period);
  return fillTemplate(template, mergeBars(parts));
}

export function workingTimeReport(
  cycles: readonly PomodoroCycle[],
  period: Period,
  titles: ReadonlyMap<string, string>,
): WorkingTimeReport {
  const slices = countedSlices(cycles);
  const bars = bucketBars(slices, period);
  const totalMs = bars.reduce((sum, bar) => sum + bar.ms, 0);
  const byTask = new Map<string, number>();
  for (const slice of slices) {
    const clipped = clip(slice.startMs, slice.endMs, period);
    if (!clipped) {
      continue;
    }
    byTask.set(
      slice.taskId,
      (byTask.get(slice.taskId) ?? 0) + (clipped.endMs - clipped.startMs),
    );
  }
  const rows: TaskRow[] = [...byTask.entries()]
    .map(([taskId, ms]) => ({
      taskId,
      title: titles.get(taskId) ?? taskId,
      ms,
      share: totalMs === 0 ? 0 : ms / totalMs,
    }))
    .sort((a, b) => {
      if (b.ms !== a.ms) {
        return b.ms - a.ms;
      }
      const byTitle = a.title.localeCompare(b.title);
      if (byTitle !== 0) {
        return byTitle;
      }
      return a.taskId.localeCompare(b.taskId);
    });
  const discarded: DiscardedTrace[] = cycles
    .filter((cycle) => cycle.outcome === "Discarded")
    .map((cycle) => ({
      cycleId: cycle.id,
      workieDay: cycle.workieDay,
      sessionCount: cycle.sessions.length,
    }));
  return { totalMs, bars, rows, discarded };
}

export function barsSum(bars: readonly Bar[]): number {
  return bars.reduce((sum, bar) => sum + bar.ms, 0);
}

export function rowsSum(rows: readonly TaskRow[]): number {
  return rows.reduce((sum, row) => sum + row.ms, 0);
}
