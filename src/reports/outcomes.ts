import type { Occurrence, StatusHistoryEvent, Task } from "../domain/types";
import { daysInPeriod } from "./period";
import type { Period } from "./types";
import {
  isOutcomeStatus,
  type OutcomeCounts,
  type OutcomeEvent,
  type OutcomeReport,
  type OutcomeStatus,
} from "./types";

function titleFor(
  event: StatusHistoryEvent,
  tasks: readonly Task[],
  occurrences: readonly Occurrence[],
): string {
  if (event.entityKind === "occurrence") {
    const occurrence = occurrences.find((item) => item.id === event.entityId);
    const task = tasks.find((item) => item.id === occurrence?.taskId);
    const name = task?.title ?? occurrence?.taskId ?? event.entityId;
    return `${name} · ${occurrence?.date ?? event.workieDay}`;
  }
  return (
    tasks.find((task) => task.id === event.entityId)?.title ?? event.entityId
  );
}

export function outcomeEvents(
  history: readonly StatusHistoryEvent[],
  tasks: readonly Task[],
  occurrences: readonly Occurrence[] = [],
): OutcomeEvent[] {
  const seen = new Set<string>();
  const events: OutcomeEvent[] = [];
  const ordered = [...history].sort((a, b) => a.at - b.at);
  for (const event of ordered) {
    if (!isOutcomeStatus(event.status)) {
      continue;
    }
    const key = `${event.entityId}|${event.status}|${event.workieDay}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    events.push({
      id: event.id,
      entityId: event.entityId,
      entityKind: event.entityKind,
      status: event.status,
      workieDay: event.workieDay,
      at: event.at,
      title: titleFor(event, tasks, occurrences),
    });
  }
  return events;
}

export function outcomeReport(
  history: readonly StatusHistoryEvent[],
  tasks: readonly Task[],
  period: Period,
  occurrences: readonly Occurrence[] = [],
): OutcomeReport {
  const days = new Set(daysInPeriod(period));
  const events = outcomeEvents(history, tasks, occurrences).filter((event) =>
    days.has(event.workieDay),
  );
  const counts: OutcomeCounts = {
    Completed: 0,
    Abandoned: 0,
    Cancelled: 0,
    Deferred: 0,
  };
  for (const event of events) {
    counts[event.status] += 1;
  }
  return { counts, events };
}

export function filterOutcomeEvents(
  events: readonly OutcomeEvent[],
  status: OutcomeStatus | null,
): OutcomeEvent[] {
  const filtered = status
    ? events.filter((event) => event.status === status)
    : [...events];
  return filtered.sort((a, b) => {
    if (a.workieDay !== b.workieDay) {
      return a.workieDay < b.workieDay ? 1 : -1;
    }
    return b.at - a.at;
  });
}

export function groupByDay(
  events: readonly OutcomeEvent[],
): { day: string; events: OutcomeEvent[] }[] {
  const groups = new Map<string, OutcomeEvent[]>();
  for (const event of events) {
    const list = groups.get(event.workieDay) ?? [];
    list.push(event);
    groups.set(event.workieDay, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, list]) => ({
      day,
      events: [...list].sort((a, b) => b.at - a.at),
    }));
}
