import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createDayPlan,
  createFixedReserveBlock,
  createFixedTaskBlock,
  createFlexibleReserveBlock,
  createFlexibleTaskBlock,
  isReserveBlock,
  isTaskBlock,
} from "./index";

const DAY = "2026-06-15";
const HOUR = 60 * 60 * 1000;

function local(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe("block model [D21] [D29]", () => {
  it("supports fixed and flexible task blocks plus reserve blocks with no task", () => {
    const noon = local(2026, 5, 15, 12);
    const fixed = createFixedTaskBlock({
      id: "f",
      taskId: "t1",
      day: DAY,
      startMs: noon,
      endMs: noon + HOUR,
    });
    const flexible = createFlexibleTaskBlock({
      id: "x",
      taskId: "t2",
      day: DAY,
      durationMs: HOUR,
      chainPosition: 0,
      precedingAnchorId: null,
    });
    const reserveFixed = createFixedReserveBlock({
      id: "rf",
      day: DAY,
      startMs: noon + 2 * HOUR,
      endMs: noon + 3 * HOUR,
    });
    const reserveFlex = createFlexibleReserveBlock({
      id: "rx",
      day: DAY,
      durationMs: HOUR,
      chainPosition: 0,
      precedingAnchorId: "f",
    });
    expect(fixed.type).toBe("fixed");
    expect(fixed.startMs).toBe(noon);
    expect(fixed.endMs).toBe(noon + HOUR);
    expect(isTaskBlock(fixed) && fixed.taskId).toBe("t1");
    expect(flexible.type).toBe("flexible");
    expect(flexible.durationMs).toBe(HOUR);
    expect(flexible.chainPosition).toBe(0);
    expect("startMs" in flexible).toBe(false);
    expect(isReserveBlock(reserveFixed)).toBe(true);
    expect(isReserveBlock(reserveFlex)).toBe(true);
    expect("taskId" in reserveFixed).toBe(false);
    expect("taskId" in reserveFlex).toBe(false);
    const plan = createDayPlan(DAY, [
      fixed,
      flexible,
      reserveFixed,
      reserveFlex,
    ]);
    expect(plan.blocks).toHaveLength(4);
  });
});

describe("calendar engine has no task-status API [D6]", () => {
  it("production calendar source never changes Task.status", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const files = walk(root).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const sourceText = readFileSync(file, "utf8");
      expect(sourceText, file).not.toMatch(/from ["'].*transitions["']/);
      expect(sourceText, file).not.toMatch(/complete\s*\(/);
      expect(sourceText, file).not.toMatch(/moveLiveStatus/);
      expect(sourceText, file).not.toMatch(/abandon\s*\(/);
      expect(sourceText, file).not.toMatch(/cancel\s*\(/);
      expect(sourceText, file).not.toMatch(/restore\s*\(/);
      expect(sourceText, file).not.toMatch(/Task\.status/);
      expect(sourceText, file).not.toMatch(/status:\s*["']Completed["']/);
      expect(sourceText, file).not.toMatch(/\bcategory\b/i);
      expect(sourceText, file).not.toMatch(/\bMissed\b/);
      expect(sourceText, file).not.toMatch(
        /plan-versus-actual|planVersusActual/,
      );
      expect(sourceText, file).not.toMatch(/productivityScore/);
    }
  });
});
