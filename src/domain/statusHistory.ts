import type { StatusEntityKind, StatusHistoryEvent, TaskStatus } from "./types";
import { CLOSED_STATUSES } from "./types";
import { workieDayKey } from "./workieDay";

export function statusEventId(
  entityId: string,
  status: TaskStatus,
  workieDay: string,
): string {
  return `${entityId}|${status}|${workieDay}`;
}

/**
 * Append a task-status event unless this entity already entered `status`
 * on this Workie day. Never mutates existing events [D14] [D50].
 */
export function recordStatusEvent(
  history: readonly StatusHistoryEvent[],
  params: {
    entityId: string;
    entityKind: StatusEntityKind;
    status: TaskStatus;
    now: number;
    workieDay?: string;
  },
): StatusHistoryEvent[] {
  const workieDay = params.workieDay ?? workieDayKey(params.now);
  const already = history.some(
    (event) =>
      event.entityId === params.entityId &&
      event.status === params.status &&
      event.workieDay === workieDay,
  );
  if (already) {
    return history.map((event) => ({ ...event }));
  }
  const event: StatusHistoryEvent = {
    id: statusEventId(params.entityId, params.status, workieDay),
    entityId: params.entityId,
    entityKind: params.entityKind,
    status: params.status,
    workieDay,
    at: params.now,
    createdAt: params.now,
    updatedAt: params.now,
  };
  return [...history.map((item) => ({ ...item })), event];
}

/**
 * Displayed outcome is a projection of current status (plus history for
 * Reports). No separate outcome enum is stored [D99].
 */
export function projectDisplayedOutcome(
  status: TaskStatus,
  history: readonly StatusHistoryEvent[],
): { currentStatus: TaskStatus } {
  void history;
  return { currentStatus: status };
}

export function lastClosingTime(
  entityId: string,
  history: readonly StatusHistoryEvent[],
): number {
  let latest = 0;
  for (const event of history) {
    if (
      event.entityId === entityId &&
      (CLOSED_STATUSES as readonly TaskStatus[]).includes(event.status) &&
      event.at > latest
    ) {
      latest = event.at;
    }
  }
  return latest;
}

/** Closed list sort key: most recent closing time [D14]. */
export function sortClosedByClosingTime<E extends { id: string }>(
  entities: readonly E[],
  history: readonly StatusHistoryEvent[],
): E[] {
  return [...entities].sort((a, b) => {
    const byTime =
      lastClosingTime(b.id, history) - lastClosingTime(a.id, history);
    if (byTime !== 0) {
      return byTime;
    }
    return a.id.localeCompare(b.id);
  });
}

export function countStatusEventsOnDay(
  history: readonly StatusHistoryEvent[],
  entityId: string,
  status: TaskStatus,
  workieDay: string,
): number {
  return history.filter(
    (event) =>
      event.entityId === entityId &&
      event.status === status &&
      event.workieDay === workieDay,
  ).length;
}
