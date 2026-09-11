import { describe, expect, it } from "vitest";
import { atMostOneUnfinishedCycle } from "./unfinishedCycle";

describe("atMostOneUnfinishedCycle", () => {
  it("allows zero or one unfinished cycle", () => {
    expect(atMostOneUnfinishedCycle(0)).toBe(true);
    expect(atMostOneUnfinishedCycle(1)).toBe(true);
  });

  it("rejects a second unfinished cycle", () => {
    expect(atMostOneUnfinishedCycle(2)).toBe(false);
  });
});
