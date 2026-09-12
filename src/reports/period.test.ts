import { describe, expect, it } from "vitest";
import { periodContaining, shiftPeriod, daysInPeriod } from "./period";

describe("period [D48] [D57]", () => {
  it("Week runs Monday 00:00 to the next Monday 00:00", () => {
    const wednesday = new Date(2026, 8, 16, 15, 0, 0, 0).getTime();
    const week = periodContaining("Week", wednesday);
    expect(new Date(week.startMs).getDay()).toBe(1);
    expect(week.endMs - week.startMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(daysInPeriod(week)).toHaveLength(7);
    expect(daysInPeriod(week)[0]).toBe("2026-09-14");
  });

  it("Day, Month and Year are calendar periods, not rolling windows", () => {
    const now = new Date(2026, 8, 16, 12, 0, 0, 0).getTime();
    const day = periodContaining("Day", now);
    const month = periodContaining("Month", now);
    const year = periodContaining("Year", now);
    expect(daysInPeriod(day)).toEqual(["2026-09-16"]);
    expect(daysInPeriod(month)[0]).toBe("2026-09-01");
    expect(daysInPeriod(month).at(-1)).toBe("2026-09-30");
    expect(daysInPeriod(year)[0]).toBe("2026-01-01");
    expect(daysInPeriod(year).at(-1)).toBe("2026-12-31");
  });

  it("previous and next keep the same kind", () => {
    const now = new Date(2026, 8, 16).getTime();
    const nextWeek = shiftPeriod(periodContaining("Week", now), 1);
    expect(nextWeek.kind).toBe("Week");
    expect(daysInPeriod(nextWeek)[0]).toBe("2026-09-21");
  });
});
