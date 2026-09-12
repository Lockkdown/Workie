import type { StatusHistoryEvent } from "../domain/types";
import { daysInPeriod } from "./period";
import type { Period } from "./types";
import type { ContributionCell, ContributionLevel } from "./types";

export function contributionLevel(count: number): ContributionLevel {
  if (count <= 0) {
    return "0";
  }
  if (count === 1) {
    return "1";
  }
  if (count === 2) {
    return "2";
  }
  if (count === 3) {
    return "3";
  }
  return "4+";
}

export function contributionCells(
  history: readonly StatusHistoryEvent[],
  year: Period,
): ContributionCell[] {
  const completed = new Map<string, Set<string>>();
  for (const event of history) {
    if (event.status !== "Completed") {
      continue;
    }
    const set = completed.get(event.workieDay) ?? new Set<string>();
    set.add(event.entityId);
    completed.set(event.workieDay, set);
  }
  return daysInPeriod(year).map((day) => {
    const count = completed.get(day)?.size ?? 0;
    return { day, count, level: contributionLevel(count) };
  });
}
