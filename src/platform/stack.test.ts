import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("stack lock", () => {
  it("declares all seven required scripts", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    for (const script of [
      "dev",
      "build",
      "typecheck",
      "test",
      "test:e2e",
      "lint",
      "format:check",
    ]) {
      expect(pkg.scripts[script]).toBeTruthy();
    }
    expect(pkg.scripts.typecheck).toMatch(/tsc --noEmit/);
    expect(pkg.scripts.build).not.toMatch(/\btsc\b/);
  });

  it("does not depend on Redux or Zustand", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    expect(names).not.toContain("redux");
    expect(names).not.toContain("react-redux");
    expect(names).not.toContain("@reduxjs/toolkit");
    expect(names).not.toContain("zustand");
  });
});
