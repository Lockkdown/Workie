import { describe, expect, it } from "vitest";
import { remainingMs } from "./remainingTime";

describe("remainingMs", () => {
  it("computes remaining time from two timestamps", () => {
    expect(remainingMs(10_000, 1_000)).toBe(9_000);
  });

  it("does not go below zero", () => {
    expect(remainingMs(1_000, 5_000)).toBe(0);
  });

  it("survives a reload without drifting: the same timestamps yield the same remaining", () => {
    const endsAt = 50_000;
    const nowAtReload = 20_000;
    const beforeUnload = remainingMs(endsAt, nowAtReload);
    const afterReload = remainingMs(endsAt, nowAtReload);
    expect(afterReload).toBe(beforeUnload);
    expect(afterReload).toBe(30_000);
  });

  it("moves only with wall-clock time, not with a tick counter", () => {
    const endsAt = 10_000;
    const tickCount = 99;
    expect(remainingMs(endsAt, 4_000)).toBe(6_000);
    expect(remainingMs(endsAt, 4_000) - tickCount).not.toBe(
      remainingMs(endsAt, 4_000),
    );
  });
});
