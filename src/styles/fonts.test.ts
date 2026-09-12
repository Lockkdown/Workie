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

  it("loads Inter 500 and Pixelify Sans 600 with swap and fallbacks", () => {
    expect(fontsCss).toMatch(/font-weight:\s*500/);
    expect(fontsCss).toMatch(/inter-latin-500-normal\.woff2/);
    expect(fontsCss).toMatch(/inter-vietnamese-500-normal\.woff2/);
    expect(fontsCss).toMatch(/font-weight:\s*600/);
    expect(fontsCss).toMatch(/pixelify-sans-latin-600-normal\.woff2/);
    expect(fontsCss).toMatch(/font-display:\s*swap/);
    expect(fontsCss).toMatch(/size-adjust:/);
  });

  it("declares no third font family [D77] [D80]", () => {
    const faces = [
      ...fontsCss.matchAll(/font-family:\s*"([^"]+)"/g),
    ].map((match) => match[1]);
    expect(faces.length).toBeGreaterThan(0);
    for (const name of new Set(faces)) {
      expect([
        "Inter",
        "Inter Fallback",
        "Pixelify Sans",
        "Pixelify Sans Fallback",
      ]).toContain(name);
    }
  });
});
