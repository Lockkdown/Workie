import { describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import { filterOutcomeEvents, groupByDay, outcomeReport } from "./outcomes";
import { statusEvent } from "./fixtures";
import { periodContaining } from "./period";

const source = { kind: "user" as const, accountId: "local" };

describe("task outcomes [D50] [D53] [D55]", () => {
  it("counts one event per status per entity per day", () => {
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
          id: "1",
          entityId: "t1",
          status: "Deferred",
          workieDay: "2026-09-16",
          at: 10,
        }),
        statusEvent({
          id: "2",
          entityId: "t1",
          status: "Completed",
          workieDay: "2026-09-16",
          at: 20,
        }),
        statusEvent({
          id: "3",
          entityId: "t1",
          status: "Completed",
          workieDay: "2026-09-16",
          at: 30,
        }),
        statusEvent({
          id: "4",
          entityId: "t1",
          status: "Waiting",
          workieDay: "2026-09-16",
          at: 5,
        }),
      ],
      [task],
      day,
    );
    expect(report.counts.Deferred).toBe(1);
    expect(report.counts.Completed).toBe(1);
    expect(report.counts.Abandoned).toBe(0);
  });

  it("week figures equal the sum of the days", () => {
    const week = periodContaining("Week", new Date(2026, 8, 16).getTime());
    const { task } = createTask({
      id: "t1",
      title: "Brief",
      now: 1,
      source,
    });
    const history = [
      statusEvent({
        id: "1",
        entityId: "t1",
        status: "Completed",
        workieDay: "2026-09-14",
        at: 1,
      }),
      statusEvent({
        id: "2",
        entityId: "t1",
        status: "Completed",
        workieDay: "2026-09-16",
        at: 2,
      }),
    ];
    const weekReport = outcomeReport(history, [task], week);
    const monday = outcomeReport(
      history,
      [task],
      periodContaining("Day", new Date(2026, 8, 14).getTime()),
    );
    const wednesday = outcomeReport(
      history,
      [task],
      periodContaining("Day", new Date(2026, 8, 16).getTime()),
    );
    expect(weekReport.counts.Completed).toBe(
      monday.counts.Completed + wednesday.counts.Completed,
    );
  });

  it("filters the list by card without changing tasks", () => {
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
          id: "1",
          entityId: "t1",
          status: "Completed",
          workieDay: "2026-09-16",
          at: 20,
        }),
        statusEvent({
          id: "2",
          entityId: "t1",
          status: "Deferred",
          workieDay: "2026-09-16",
          at: 10,
        }),
      ],
      [task],
      day,
    );
    const filtered = filterOutcomeEvents(report.events, "Completed");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("Brief");
    expect(groupByDay(filtered)[0]?.day).toBe("2026-09-16");
    expect(task.status).toBe("Waiting");
  });
});
