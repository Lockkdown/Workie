import {
  AXIS_HEIGHT_PX,
  HOURS_IN_DAY,
  MINUTES_IN_DAY,
  SNAP_MS,
} from "./constants";

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatHm(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function minutesOnAxis(epochMs: number): number {
  const d = new Date(epochMs);
  return (
    d.getHours() * 60 +
    d.getMinutes() +
    d.getSeconds() / 60 +
    d.getMilliseconds() / 60_000
  );
}

export function topPxFromMs(epochMs: number): number {
  return (minutesOnAxis(epochMs) / MINUTES_IN_DAY) * AXIS_HEIGHT_PX;
}

export function heightPxFromDuration(durationMs: number): number {
  return Math.max((durationMs / (MINUTES_IN_DAY * 60_000)) * AXIS_HEIGHT_PX, 8);
}

export function hourLabels(): string[] {
  return Array.from(
    { length: HOURS_IN_DAY + 1 },
    (_, hour) => `${pad2(hour)}:00`,
  );
}

export function snapMinutes(minutes: number): number {
  const step = SNAP_MS / 60_000;
  return Math.round(minutes / step) * step;
}

export function msFromAxisY(y: number, dayStartMs: number): number {
  const ratio = y / AXIS_HEIGHT_PX;
  const minutes = snapMinutes(ratio * MINUTES_IN_DAY);
  const clamped = Math.min(Math.max(minutes, 0), MINUTES_IN_DAY);
  const start = new Date(dayStartMs);
  start.setHours(0, 0, 0, 0);
  start.setMinutes(clamped);
  return start.getTime();
}

export function startOfLocalDay(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function hmFromMs(epochMs: number): { hour: number; minute: number } {
  const d = new Date(epochMs);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

export function msFromHm(
  dayStartMs: number,
  hour: number,
  minute: number,
): number {
  const start = new Date(dayStartMs);
  start.setHours(hour, snapMinutes(minute), 0, 0);
  return start.getTime();
}

export function formatSpan(startMs: number, endMs: number): string {
  return `${formatHm(startMs)}–${formatHm(endMs)}`;
}
