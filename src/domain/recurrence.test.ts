import { describe, expect, it } from "vitest";
import {
  backfillMissedOccurrences,
  ensureTomorrowOccurrences,
} from "./recurrence";
import { createTask } from "./taskModel";
import { complete } from "./transitions";
import { missedWorkieDays, tomorrowWorkieDay, weekdayOfDay } from "./workieDay";

const source = { kind: "user" as const, accountId: "local" };

function atNoon(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day, 12, 0, 0, 0).getTime();
}

function ids(): () => string {
  let n = 0;
  return () => `occ-${++n}`;
}

describe("recurrence [D13] [D99]", () => {
  it("creates tomorrow's occurrence for each matching rule exactly once", () => {
    const now = atNoon(2026, 5, 15);
    const { task } = createTask({
      id: "daily",
      title: "Daily",
      now,
      source,
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const first = ensureTomorrowOccurrences({
      now,
      tasks: [task],
      occurrences: [],
      newId: ids(),
    });
    expect(first).toHaveLength(1);
    expect(first[0]?.occurrence.date).toBe(tomorrowWorkieDay(now));
    const second = ensureTomorrowOccurrences({
      now,
      tasks: [task],
      occurrences: [first[0]!.occurrence],
      newId: ids(),
    });
    expect(second).toHaveLength(0);
  });

  it("does not create tomorrow occurrences for one-off tasks", () => {
    const now = atNoon(2026, 5, 15);
    const { task } = createTask({
      id: "once",
      title: "Once",
      now,
      source,
    });
    expect(
      ensureTomorrowOccurrences({
        now,
        tasks: [task],
        occurrences: [],
        newId: ids(),
      }),
    ).toHaveLength(0);
  });

  it.each([3, 14, 90])(
    "back-fills every missed due occurrence for %s closed days without duplicates or cap [D13]",
    (closedDays) => {
      const now = atNoon(2026, 5, 15);
      const lastOpen = atNoon(2026, 5, 15 - closedDays);
      expect(missedWorkieDays(lastOpen, now)).toHaveLength(closedDays);
      const { task } = createTask({
        id: "daily",
        title: "Daily",
        now: lastOpen,
        source,
        repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
      });
      const first = backfillMissedOccurrences({
        now,
        lastOpen,
        tasks: [task],
        occurrences: [],
        newId: ids(),
      });
      expect(first).toHaveLength(closedDays);
      const dates = first.map((item) => item.occurrence.date);
      expect(new Set(dates).size).toBe(closedDays);
      const second = backfillMissedOccurrences({
        now,
        lastOpen,
        tasks: [task],
        occurrences: first.map((item) => item.occurrence),
        newId: ids(),
      });
      expect(second).toHaveLength(0);
    },
  );

  it("back-fills a weekday rule for every matching missed day with no roll-up", () => {
    const now = atNoon(2026, 5, 15);
    const lastOpen = atNoon(2026, 2, 17);
    const { task } = createTask({
      id: "mondays",
      title: "Monday only",
      now: lastOpen,
      source,
      repeatWeekdays: [1],
    });
    const created = backfillMissedOccurrences({
      now,
      lastOpen,
      tasks: [task],
      occurrences: [],
      newId: ids(),
    });
    expect(created.length).toBeGreaterThan(1);
    expect(created.length).toBe(
      missedWorkieDays(lastOpen, now).filter((day) => weekdayOfDay(day) === 1)
        .length,
    );
  });

  it("does not back-fill days before the task existed", () => {
    const now = atNoon(2026, 5, 15);
    const lastOpen = atNoon(2026, 5, 1);
    const { task } = createTask({
      id: "late",
      title: "Late",
      now: atNoon(2026, 5, 13),
      source,
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const created = backfillMissedOccurrences({
      now,
      lastOpen,
      tasks: [task],
      occurrences: [],
      newId: ids(),
    });
    expect(created.map((item) => item.occurrence.date)).toEqual([
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
    ]);
  });

  it("changing one occurrence does not change others or the recurrence rule [D99]", () => {
    const now = atNoon(2026, 5, 15);
    const lastOpen = atNoon(2026, 5, 12);
    const { task } = createTask({
      id: "daily",
      title: "Daily",
      now: lastOpen,
      source,
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const seeded = backfillMissedOccurrences({
      now,
      lastOpen,
      tasks: [task],
      occurrences: [],
      newId: ids(),
    });
    const first = seeded[0];
    const second = seeded[1];
    expect(first && second).toBeTruthy();
    const closed = complete(first!.occurrence, now, first!.history);
    expect(closed.entity.status).toBe("Completed");
    expect(second!.occurrence.status).toBe("Waiting");
    expect(task.repeatWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(closed.entity.taskId).toBe("daily");
  });
});
