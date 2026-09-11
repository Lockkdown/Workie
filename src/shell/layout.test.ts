import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shell.css"),
  "utf8",
);

describe("shell layout css", () => {
  it("gives the timeline width priority over the rails", () => {
    expect(css).toMatch(
      /\.desk-zone\[data-zone="timeline"\]\s*\{[^}]*flex:\s*1 1 24rem/,
    );
    expect(css).toMatch(
      /\.desk-zone\[data-zone="tray"\]\s*\{[^}]*flex:\s*0 1 12rem/,
    );
    expect(css).toMatch(
      /\.desk-zone\[data-zone="now"\]\s*\{[^}]*flex:\s*0 1 12rem/,
    );
    expect(css).toMatch(
      /\.desk-zone\[data-zone="timeline"\]\s*\{[^}]*min-width:\s*16rem/,
    );
    expect(css).toMatch(
      /\.desk-zone\[data-zone="tray"\]\s*\{[^}]*min-width:\s*8rem/,
    );
    expect(css).toMatch(
      /\.desk-zone\[data-zone="now"\]\s*\{[^}]*min-width:\s*8rem/,
    );
  });

  it("keeps app navigation and desk modes as different shapes", () => {
    expect(css).toMatch(/\.app-nav\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.desk-modes\s*\{[^}]*flex-direction:\s*row/);
    expect(css).toMatch(/@media \(min-width:\s*1024px\)/);
    expect(css).toMatch(/@media \(max-width:\s*1023px\)/);
  });

  it("lets the task tray collapse without dropping the zone", () => {
    expect(css).toMatch(
      /\.desk-zone\[data-collapsed="true"\] \.desk-zone-body\s*\{[^}]*display:\s*none/,
    );
  });
});
