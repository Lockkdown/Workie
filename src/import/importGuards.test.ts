import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const importRoot = dirname(fileURLToPath(import.meta.url));

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

describe("import module guards [D58] [D96]", () => {
  it("does not use localStorage, fetch, or Vault/AI clients", () => {
    for (const file of walk(importRoot)) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\blocalStorage\b/);
      expect(source, file).not.toMatch(/\bfetch\s*\(/);
      expect(source, file).not.toMatch(/openai|anthropic|obsidian/i);
      expect(source, file).not.toMatch(/\bFileReader\b/);
      expect(source, file).not.toMatch(/\bsetTimeout\b/);
    }
  });

  it("keeps envelope, duplicate, and commit rules free of React", () => {
    for (const name of [
      "envelope.ts",
      "duplicates.ts",
      "commit.ts",
      "draft.ts",
      "reviewState.ts",
      "normalize.ts",
      "ingest.ts",
    ]) {
      const source = readFileSync(join(importRoot, name), "utf8");
      expect(source, name).not.toMatch(/from ["']react["']/);
    }
  });
});
