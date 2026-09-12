import { describe, expect, it } from "vitest";
import { contributionCells, contributionLevel } from "./contribution";
import { statusEvent } from "./fixtures";
import { contributionYear } from "./period";

describe("contribution [D51]", () => {
  it("uses exactly five absolute levels", () => {
    expect(contributionLevel(0)).toBe("0");
    expect(contributionLevel(1)).toBe("1");
    expect(contributionLevel(2)).toBe("2");
    expect(contributionLevel(3)).toBe("3");
    expect(contributionLevel(4)).toBe("4+");
    expect(contributionLevel(6)).toBe("4+");
  });

  it("counts unique completed tasks per day and never varies by year", () => {
    const year = contributionYear(2026);
    const cells = contributionCells(
      [
        statusEvent({
          id: "a",
          entityId: "t1",
          status: "Completed",
          workieDay: "2026-01-02",
          at: 1,
        }),
        statusEvent({
          id: "b",
          entityId: "t1",
          status: "Completed",
          workieDay: "2026-01-02",
          at: 2,
        }),
        statusEvent({
          id: "c",
          entityId: "t2",
          status: "Completed",
          workieDay: "2026-01-02",
          at: 3,
        }),
      ],
      year,
    );
    expect(cells).toHaveLength(365);
    const day = cells.find((cell) => cell.day === "2026-01-02");
    expect(day?.count).toBe(2);
    expect(day?.level).toBe("2");
  });
});
