import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fontsCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fonts.css"),
  "utf8",
);

describe("font loading", () => {
  it("loads Pixelify Sans and Inter with metric-matched fallbacks", () => {
    expect(fontsCss).toMatch(/font-family: "Pixelify Sans"/);
    expect(fontsCss).toMatch(/font-family: "Inter"/);
    expect(fontsCss).toMatch(/size-adjust:/);
    expect(fontsCss).toMatch(/ascent-override:/);
  });

  it("includes the Vietnamese unicode-range on Inter", () => {
    expect(fontsCss).toMatch(/U\+1EA0-1EF9/);
  });
});
