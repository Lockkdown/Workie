import { describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import { contributionCells, contributionLevel } from "./contribution";
import { endedCycle, statusEvent } from "./fixtures";
import { outcomeReport } from "./outcomes";
import { contributionYear, periodContaining } from "./period";
import { barsSum, rowsSum, workingTimeReport } from "./workingTime";

const source = { kind: "user" as const, accountId: "local" };

describe("F6 edge cases", () => {
  it("a focus session 23:40 to 00:20 splits into the correct day buckets", () => {
    const start = new Date(2026, 8, 16, 23, 40, 0, 0).getTime();
    const end = new Date(2026, 8, 17, 0, 20, 0, 0).getTime();
    const cycle = endedCycle({
      id: "night",
      taskId: "a",
      startMs: start,
      endMs: end,
      outcome: "Timer complete",
      workieDay: "2026-09-16",
    });
    const first = workingTimeReport(
      [cycle],
      periodContaining("Day", start),
      new Map([["a", "Alpha"]]),
    );
    const second = workingTimeReport(
      [cycle],
      periodContaining("Day", end),
      new Map([["a", "Alpha"]]),
    );
    expect(first.totalMs).toBe(20 * 60_000);
    expect(second.totalMs).toBe(20 * 60_000);
    expect(barsSum(first.bars)).toBe(first.totalMs);
    expect(barsSum(second.bars)).toBe(second.totalMs);
  });

  it("a multi-task cycle crossing an hour still sums bars and rows to the total", () => {
    const start = new Date(2026, 8, 16, 10, 50, 0, 0).getTime();
    const report = workingTimeReport(
      [
        endedCycle({
          id: "c",
          taskId: "a",
          startMs: start,
          endMs: start + 20 * 60_000,
          outcome: "Timer complete",
          workieDay: "2026-09-16",
          second: {
            taskId: "b",
            startMs: start + 10 * 60_000,
            endMs: start + 20 * 60_000,
          },
        }),
      ],
      periodContaining("Day", start),
      new Map([
        ["a", "Alpha"],
        ["b", "Beta"],
      ]),
    );
    expect(barsSum(report.bars)).toBe(report.totalMs);
    expect(rowsSum(report.rows)).toBe(report.totalMs);
    expect(report.rows.map((row) => row.taskId).sort()).toEqual(["a", "b"]);
  });

  it("deferred in the morning and completed in the afternoon are two events", () => {
    const { task } = createTask({
      id: "t1",
      title: "Brief",
      now: 1,
      source,
    });
    const day = periodContaining("Day", new Date(2026, 8, 16).getTime());
    const report = outcomeReport(
      [
        statusEvent({
          id: "d",
          entityId: "t1",
          status: "Deferred",
          workieDay: "2026-09-16",
          at: 8,
        }),
        statusEvent({
          id: "c",
          entityId: "t1",
          status: "Completed",
          workieDay: "2026-09-16",
          at: 16,
        }),
      ],
      [task],
      day,
    );
    expect(report.counts.Deferred).toBe(1);
    expect(report.counts.Completed).toBe(1);
  });

  it("completed, restored, completed again the same day is one Completed event and one contribution", () => {
    const year = contributionYear(2026);
    const history = [
      statusEvent({
        id: "c1",
        entityId: "t1",
        status: "Completed",
        workieDay: "2026-09-16",
        at: 10,
      }),
      statusEvent({
        id: "c2",
        entityId: "t1",
        status: "Completed",
        workieDay: "2026-09-16",
        at: 20,
      }),
    ];
    const { task } = createTask({
      id: "t1",
      title: "Brief",
      now: 1,
      source,
    });
    const day = periodContaining("Day", new Date(2026, 8, 16).getTime());
    expect(outcomeReport(history, [task], day).counts.Completed).toBe(1);
    expect(
      contributionCells(history, year).find((cell) => cell.day === "2026-09-16")
        ?.count,
    ).toBe(1);
  });

  it("completed on two different days is two events and two contributions", () => {
    const history = [
      statusEvent({
        id: "c1",
        entityId: "t1",
        status: "Completed",
        workieDay: "2026-09-16",
        at: 10,
      }),
      statusEvent({
        id: "c2",
        entityId: "t1",
        status: "Completed",
        workieDay: "2026-09-17",
        at: 20,
      }),
    ];
    const { task } = createTask({
      id: "t1",
      title: "Brief",
      now: 1,
      source,
    });
    const week = periodContaining("Week", new Date(2026, 8, 16).getTime());
    expect(outcomeReport(history, [task], week).counts.Completed).toBe(2);
    const cells = contributionCells(history, contributionYear(2026));
    expect(cells.find((cell) => cell.day === "2026-09-16")?.count).toBe(1);
    expect(cells.find((cell) => cell.day === "2026-09-17")?.count).toBe(1);
  });

  it("six completed tasks on one day is the 4+ level", () => {
    const history = Array.from({ length: 6 }, (_, index) =>
      statusEvent({
        id: `c${index}`,
        entityId: `t${index}`,
        status: "Completed",
        workieDay: "2026-09-16",
        at: index,
      }),
    );
    const cell = contributionCells(history, contributionYear(2026)).find(
      (item) => item.day === "2026-09-16",
    );
    expect(cell?.count).toBe(6);
    expect(cell?.level).toBe("4+");
    expect(contributionLevel(6)).toBe("4+");
  });

  it("a period of only Discarded cycles reads zero working time and stays traceable", () => {
    const start = new Date(2026, 8, 16, 12, 0, 0, 0).getTime();
    const report = workingTimeReport(
      [
        endedCycle({
          id: "d1",
          taskId: "a",
          startMs: start,
          endMs: start + 12 * 60_000,
          outcome: "Discarded",
          workieDay: "2026-09-16",
        }),
      ],
      periodContaining("Day", start),
      new Map([["a", "Alpha"]]),
    );
    expect(report.totalMs).toBe(0);
    expect(report.discarded.map((item) => item.cycleId)).toEqual(["d1"]);
  });

  it("a Year period shows empty month bars before the app existed", () => {
    const start = new Date(2026, 8, 16, 12, 0, 0, 0).getTime();
    const report = workingTimeReport(
      [
        endedCycle({
          id: "late",
          taskId: "a",
          startMs: start,
          endMs: start + 5 * 60_000,
          outcome: "Timer complete",
          workieDay: "2026-09-16",
        }),
      ],
      periodContaining("Year", start),
      new Map([["a", "Alpha"]]),
    );
    expect(report.bars).toHaveLength(12);
    expect(report.bars[0]?.ms).toBe(0);
    expect(report.bars[8]?.ms).toBe(5 * 60_000);
    expect(barsSum(report.bars)).toBe(report.totalMs);
  });
});
