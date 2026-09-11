import { describe, expect, it } from "vitest";
import {
  createOccurrence,
  createTask,
  deriveTimeGrouping,
  hasBlocks,
  isDailyRepeat,
  isScheduled,
  parseRepeatWeekdays,
  setBlockIds,
} from "./taskModel";
import { addLocalDays, startOfWeekMonday, workieDayKey } from "./workieDay";

const source = { kind: "user" as const, accountId: "local" };
const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();

describe("task model [D10] [D17] [D8] [D12] [D13]", () => {
  it("creates a one-off Waiting unscheduled task with no block", () => {
    const { task, history } = createTask({
      id: "t1",
      title: "Write spec",
      now,
      source,
    });
    expect(task.status).toBe("Waiting");
    expect(task.blockIds).toEqual([]);
    expect(hasBlocks(task)).toBe(false);
    expect(isScheduled(task)).toBe(false);
    expect(task.repeatWeekdays).toBeUndefined();
    expect(task.subtasks).toEqual([]);
    expect(task.source).toEqual(source);
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("Waiting");
  });

  it("requires a title and stores it verbatim including Vietnamese", () => {
    expect(() => createTask({ id: "t", title: "   ", now, source })).toThrow(
      /Title is required/,
    );
    const { task } = createTask({
      id: "t",
      title: "  Việc cần làm  ",
      now,
      source,
    });
    expect(task.title).toBe("Việc cần làm");
  });

  it("stores source as user or AI mark [D8]", () => {
    const user = createTask({ id: "u", title: "U", now, source }).task;
    expect(user.source).toEqual({ kind: "user", accountId: "local" });
    const ai = createTask({
      id: "a",
      title: "Imported",
      now,
      source: {
        kind: "ai",
        sourceName: "Vault roadmap",
        sourceMark: "vault:roadmap",
        itemKey: "item-9",
      },
    }).task;
    expect(ai.source.kind).toBe("ai");
    if (ai.source.kind === "ai") {
      expect(ai.source.sourceName).toBe("Vault roadmap");
      expect(ai.source.sourceMark).toBe("vault:roadmap");
      expect(ai.source.itemKey).toBe("item-9");
    }
  });

  it("allows many block ids while keeping one status [D12]", () => {
    const { task } = createTask({ id: "t", title: "T", now, source });
    const scheduled = setBlockIds(task, ["b1", "b2", "b3"], now + 1);
    expect(scheduled.status).toBe("Waiting");
    expect(scheduled.blockIds).toEqual(["b1", "b2", "b3"]);
    expect(isScheduled(scheduled)).toBe(true);
    expect(hasBlocks(scheduled)).toBe(true);
  });

  it("treats a weekday set of seven days as daily, and rejects non-weekdays [D13]", () => {
    const weekdays = parseRepeatWeekdays([0, 1, 2, 3, 4, 5, 6]);
    expect(isDailyRepeat(weekdays)).toBe(true);
    expect(parseRepeatWeekdays([1, 1, 3])).toEqual([1, 3]);
    expect(() => parseRepeatWeekdays([7])).toThrow(/weekday set only/);
    expect(() => parseRepeatWeekdays([-1])).toThrow(/weekday set only/);
    const { task } = createTask({
      id: "r",
      title: "Repeat",
      now,
      source,
      repeatWeekdays: [1, 3, 5],
    });
    expect(task.repeatWeekdays).toEqual([1, 3, 5]);
    expect(JSON.stringify(task)).not.toMatch(/month/i);
    expect(JSON.stringify(task)).not.toMatch(/year/i);
    expect(JSON.stringify(task)).not.toMatch(/everyN/i);
  });

  it("derives time grouping and never stores it as status [D5]", () => {
    const { task } = createTask({ id: "t", title: "T", now, source });
    expect(deriveTimeGrouping([], now)).toBe("Unscheduled");
    expect(deriveTimeGrouping([now], now)).toBe("Today");
    const weekStart = startOfWeekMonday(now);
    const weekEnd = addLocalDays(weekStart, 7);
    let laterThisWeek = weekStart;
    while (
      laterThisWeek < weekEnd &&
      workieDayKey(laterThisWeek) === workieDayKey(now)
    ) {
      laterThisWeek = addLocalDays(laterThisWeek, 1);
    }
    expect(deriveTimeGrouping([laterThisWeek], now)).toBe("This week");
    const nextMonth = new Date(2026, 6, 15, 9, 0, 0, 0).getTime();
    expect(deriveTimeGrouping([nextMonth], now)).toBe("Other");
    expect("timeGrouping" in task).toBe(false);
    expect(task.status).toBe("Waiting");
  });

  it("creates occurrences as dated Waiting instances [D13] [D99]", () => {
    const { occurrence, history } = createOccurrence({
      id: "o1",
      taskId: "t1",
      date: "2026-06-16",
      now,
    });
    expect(occurrence.date).toBe("2026-06-16");
    expect(occurrence.status).toBe("Waiting");
    expect(occurrence.blockIds).toEqual([]);
    expect(history[0]?.entityKind).toBe("occurrence");
  });

  it("JSON of a created task has no category field [D64]", () => {
    const { task } = createTask({
      id: "t",
      title: "T",
      now,
      source,
      description: "long text",
      subtasks: [{ id: "s1", title: "one", done: false }],
    });
    const json = JSON.stringify(task);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect("category" in task).toBe(false);
    expect("category" in parsed).toBe(false);
    expect(json).not.toMatch(/category/i);
    expect("project" in parsed).toBe(false);
    expect("assignee" in parsed).toBe(false);
    expect("outcome" in parsed).toBe(false);
  });
});
