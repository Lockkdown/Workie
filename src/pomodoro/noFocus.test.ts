import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("no Focus mode [D45]", () => {
  it("does not name a Focus screen or navigation in the Now rail", () => {
    const source = readFileSync(join(__dirname, "NowRail.tsx"), "utf8");
    expect(source).not.toMatch(/>Focus</);
    expect(source).not.toMatch(/"Focus"/);
    expect(source).not.toMatch(/Focus mode/);
  });
});
