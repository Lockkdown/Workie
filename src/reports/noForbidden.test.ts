import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

describe("Reports forbids Section E metrics [D47] [D55] [D56]", () => {
  it("contains no productivity score, Missed card, or plan-versus-actual", () => {
    const files = [
      "workingTime.ts",
      "outcomes.ts",
      "contribution.ts",
      "ReportsSurface.tsx",
      "copy.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source, file).not.toMatch(/productivity score/i);
      expect(source, file).not.toMatch(/plan-versus-actual/i);
      expect(source, file).not.toMatch(/plan vs actual/i);
      expect(source, file).not.toMatch(/\bMissed\b/);
      expect(source, file).not.toMatch(/\blocalStorage\b/);
      expect(source, file).not.toMatch(/Focus mode/);
    }
  });
});
