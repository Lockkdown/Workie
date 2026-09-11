import { describe, expect, it } from "vitest";
import { cardSignals } from "./cardSignals";
import { createOccurrence, createTask, setBlockIds } from "./taskModel";

const source = { kind: "user" as const, accountId: "local" };
const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();

describe("cardSignals [D8] [D12] [D16]", () => {
  it("shows Unscheduled when there are no blocks", () => {
    const { task } = createTask({ id: "t1", title: "T", now, source });
    const signals = cardSignals({ task, blocks: [], now });
    expect(signals.title).toBe("T");
    expect(signals.status).toBe("Waiting");
    expect(signals.source).toEqual(source);
    expect(signals.nearestBlock).toBe("Unscheduled");
    expect(signals.extraBlocksCaption).toBeUndefined();
  });

  it("derives nearest block plus +N for a task with several blocks and one status", () => {
    const { task } = createTask({ id: "t1", title: "T", now, source });
    const planned = setBlockIds(task, ["b1", "b2", "b3"], now);
    const blocks = [
      { id: "b1", startsAt: now + 60_000 },
      { id: "b2", startsAt: now + 120_000 },
      { id: "b3", startsAt: now + 180_000 },
    ];
    const signals = cardSignals({ task: planned, blocks, now });
    expect(signals.status).toBe("Waiting");
    expect(signals.nearestBlock).toEqual(blocks[0]);
    expect(signals.extraBlockCount).toBe(2);
    expect(signals.extraBlocksCaption).toBe("+2 blocks");
  });

  it("shows subtask progress and a repeat mark with occurrence date", () => {
    const { task } = createTask({
      id: "t1",
      title: "T",
      now,
      source,
      repeatWeekdays: [1],
      subtasks: [
        { id: "s1", title: "a", done: true },
        { id: "s2", title: "b", done: false },
      ],
    });
    const { occurrence } = createOccurrence({
      id: "o1",
      taskId: "t1",
      date: "2026-06-16",
      now,
    });
    const signals = cardSignals({ task, occurrence, blocks: [], now });
    expect(signals.subtaskProgress).toEqual({ done: 1, total: 2 });
    expect(signals.repeat).toEqual({
      mark: true,
      occurrenceDate: "2026-06-16",
    });
  });
});
