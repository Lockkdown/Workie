import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(path);
    }
    return path.endsWith(".ts") ||
      path.endsWith(".tsx") ||
      path.endsWith(".css")
      ? [path]
      : [];
  });
}

describe("platform guards", () => {
  it("does not use localStorage for domain data", () => {
    for (const file of walk(srcRoot)) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\blocalStorage\b/);
    }
  });

  it("keeps domain rules free of React", () => {
    const domainRoot = join(srcRoot, "domain");
    for (const file of walk(domainRoot)) {
      if (file.endsWith(".test.ts")) {
        continue;
      }
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /from ["']react["']/,
      );
    }
  });
});
