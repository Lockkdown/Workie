import { describe, expect, it } from "vitest";
import { barsSum, rowsSum, workingTimeReport } from "./workingTime";
import { endedCycle } from "./fixtures";
import { periodContaining } from "./period";

describe("working time [D49] [D52] [D54]", () => {
  it("bars and Time by Task rows sum to the period total", () => {
    const start = new Date(2026, 8, 16, 9, 0, 0, 0).getTime();
    const report = workingTimeReport(
      [
        endedCycle({
          id: "c1",
          taskId: "a",
          startMs: start,
          endMs: start + 20 * 60_000,
          outcome: "Timer complete",
          workieDay: "2026-09-16",
          second: {
            taskId: "b",
            startMs: start + 20 * 60_000,
            endMs: start + 50 * 60_000,
          },
        }),
      ],
      periodContaining("Day", start),
      new Map([
        ["a", "Alpha"],
        ["b", "Beta"],
      ]),
    );
    expect(report.totalMs).toBe(50 * 60_000);
    expect(barsSum(report.bars)).toBe(report.totalMs);
    expect(rowsSum(report.rows)).toBe(report.totalMs);
    expect(report.rows[0]?.taskId).toBe("b");
    expect(report.rows[0]?.ms).toBe(30 * 60_000);
  });

  it("excludes Discarded cycles from totals while keeping a trace", () => {
    const start = new Date(2026, 8, 16, 10, 0, 0, 0).getTime();
    const report = workingTimeReport(
      [
        endedCycle({
          id: "gone",
          taskId: "a",
          startMs: start,
          endMs: start + 10 * 60_000,
          outcome: "Discarded",
          workieDay: "2026-09-16",
        }),
      ],
      periodContaining("Day", start),
      new Map([["a", "Alpha"]]),
    );
    expect(report.totalMs).toBe(0);
    expect(report.discarded).toHaveLength(1);
    expect(report.discarded[0]?.cycleId).toBe("gone");
  });

  it("counts Unscheduled sessions and ignores calendar block length", () => {
    const start = new Date(2026, 8, 16, 11, 0, 0, 0).getTime();
    const report = workingTimeReport(
      [
        endedCycle({
          id: "u",
          taskId: "a",
          startMs: start,
          endMs: start + 8 * 60_000,
          outcome: "Stopped early",
          workieDay: "2026-09-16",
          blockId: null,
        }),
      ],
      periodContaining("Day", start),
      new Map([["a", "Alpha"]]),
    );
    expect(report.totalMs).toBe(8 * 60_000);
    expect(report.rows[0]?.ms).toBe(8 * 60_000);
  });
});
