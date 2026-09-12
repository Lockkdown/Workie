import { describe, expect, it } from "vitest";
import {
  AA_FLOOR,
  AA_NOT_APPLICABLE,
  CONFORMANCE_CLAIM,
  D92_ENHANCEMENTS,
  claimsFullApplicationAaa,
} from "./checklist";

describe("T12 accessibility checklist [D92]", () => {
  it("separates the WCAG 2.2 AA floor from the two D92 enhancements", () => {
    expect(AA_FLOOR.length).toBeGreaterThan(20);
    expect(AA_FLOOR.every((item) => item.level === "AA")).toBe(true);
    expect(AA_FLOOR.every((item) => item.role === "mandatory-floor")).toBe(
      true,
    );
    expect(D92_ENHANCEMENTS).toHaveLength(2);
    expect(D92_ENHANCEMENTS.map((item) => item.id).sort()).toEqual([
      "2.4.13",
      "2.5.5",
    ]);
    expect(D92_ENHANCEMENTS.every((item) => item.level === "AAA")).toBe(true);
    expect(
      D92_ENHANCEMENTS.every((item) => item.role === "selected-enhancement"),
    ).toBe(true);
    const floorIds = new Set(AA_FLOOR.map((item) => item.id));
    for (const item of D92_ENHANCEMENTS) {
      expect(floorIds.has(item.id)).toBe(false);
    }
  });

  it("does not claim blanket or full-application AAA", () => {
    expect(CONFORMANCE_CLAIM).toContain("Level AA");
    expect(CONFORMANCE_CLAIM).toContain("Two enhancements");
    expect(CONFORMANCE_CLAIM).toContain("not a full-application AAA claim");
    expect(claimsFullApplicationAaa(CONFORMANCE_CLAIM)).toBe(false);
    expect(claimsFullApplicationAaa("blanket AAA")).toBe(true);
    expect(
      AA_NOT_APPLICABLE.every((item) => item.role === "not-applicable"),
    ).toBe(true);
  });
});
