/** Remaining time is derived from durable timestamps, never tick counts [D98]. */
export function remainingMs(endsAtEpochMs: number, nowEpochMs: number): number {
  if (!Number.isFinite(endsAtEpochMs) || !Number.isFinite(nowEpochMs)) {
    return 0;
  }
  return Math.max(0, endsAtEpochMs - nowEpochMs);
}
