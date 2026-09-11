import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cardSignals } from "./cardSignals";
import { backfillMissedOccurrences } from "./recurrence";
import { countStatusEventsOnDay } from "./statusHistory";
import { createTask, setBlockIds } from "./taskModel";
import { complete, moveLiveStatus, restore } from "./transitions";
import { workieDayKey } from "./workieDay";

const source = { kind: "user" as const, accountId: "local" };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe("F2 edge cases", () => {
  it("repeating task, day app never opened: back-fill once, no duplicates [D13]", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    const lastOpen = new Date(2026, 5, 12, 12, 0, 0, 0).getTime();
    const { task } = createTask({
      id: "rep",
      title: "Daily",
      now: lastOpen,
      source,
      repeatWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    let n = 0;
    const first = backfillMissedOccurrences({
      now,
      lastOpen,
      tasks: [task],
      occurrences: [],
      newId: () => `o-${++n}`,
    });
    expect(first).toHaveLength(3);
    const second = backfillMissedOccurrences({
      now,
      lastOpen,
      tasks: [task],
      occurrences: first.map((item) => item.occurrence),
      newId: () => `o-${++n}`,
    });
    expect(second).toHaveLength(0);
  });

  it("task with several blocks: one status; nearest + N [D12] [D16]", () => {
    const now = 1_000;
    const { task } = createTask({ id: "t", title: "T", now, source });
    const planned = setBlockIds(task, ["b1", "b2"], now);
    const signals = cardSignals({
      task: planned,
      now,
      blocks: [
        { id: "b1", startsAt: 2_000 },
        { id: "b2", startsAt: 3_000 },
      ],
    });
    expect(signals.status).toBe(planned.status);
    expect(signals.nearestBlock).toEqual({ id: "b1", startsAt: 2_000 });
    expect(signals.extraBlocksCaption).toBe("+1 blocks");
  });

  it("same status twice one day: history once [D50]", () => {
    const now = new Date(2026, 5, 15, 8, 0, 0, 0).getTime();
    const seeded = createTask({ id: "t", title: "T", now, source });
    const a = moveLiveStatus(
      seeded.task,
      "In Progress",
      now + 1,
      seeded.history,
    );
    const b = moveLiveStatus(a.entity, "Waiting", now + 2, a.history);
    const c = moveLiveStatus(b.entity, "Waiting", now + 3, b.history);
    expect(
      countStatusEventsOnDay(c.history, "t", "Waiting", workieDayKey(now)),
    ).toBe(1);
    expect(c.entity.status).toBe("Waiting");
  });

  it("restore after counted: earlier events stay [D14] [D50]", () => {
    const now = new Date(2026, 5, 15, 8, 0, 0, 0).getTime();
    const later = new Date(2026, 5, 16, 8, 0, 0, 0).getTime();
    const seeded = createTask({ id: "t", title: "T", now, source });
    const closed = complete(seeded.task, now + 1, seeded.history);
    const recorded = closed.history.map((event) => ({ ...event }));
    const restored = restore(closed.entity, later, closed.history);
    for (const event of recorded) {
      expect(restored.history.find((item) => item.id === event.id)).toEqual(
        event,
      );
    }
  });

  it("N/A UI: long titles are stored in full; density/scannability belongs to T5 / F9 [D74] [D87]", () => {
    const title = "A".repeat(500);
    const { task } = createTask({
      id: "long",
      title,
      now: 1,
      source,
    });
    expect(task.title).toBe(title);
    expect(task.title.length).toBe(500);
  });
});

describe("forbidden surfaces [D4] [D64] [D55]", () => {
  it("domain and persistence source contain no category field, Missed status, or timer-complete API", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const files = walk(root).filter(
      (file) =>
        (file.includes(`${join("domain")}`) ||
          file.includes(`${join("db")}`)) &&
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        !file.endsWith(".test.ts"),
    );
    for (const file of files) {
      const sourceText = readFileSync(file, "utf8");
      expect(sourceText, file).not.toMatch(/\bcategory\b/i);
      expect(sourceText, file).not.toMatch(/\bMissed\b/);
      expect(sourceText, file).not.toMatch(/completeFromTimer/);
      expect(sourceText, file).not.toMatch(/completeFromBlock/);
      expect(sourceText, file).not.toMatch(/completeFromCycle/);
      expect(sourceText, file).not.toMatch(/completeFromAi/);
      expect(sourceText, file).not.toMatch(/\blocalStorage\b/);
    }
  });
});
