import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrimitivesHarness } from "./PrimitivesHarness";

describe("primitives harness", () => {
  it("shows both themes and one prominent filled button per surface", () => {
    const html = renderToStaticMarkup(createElement(PrimitivesHarness));
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-theme="light"');
    expect(html).toContain("Waiting");
    expect(html).toContain("In Progress");
    expect(html).toContain("Deferred");
    expect(html).toContain("Completed");
    expect(html).toContain("Abandoned");
    expect(html).toContain("Cancelled");
    expect(html).toContain("Fixed");
    expect(html).toContain("Flexible");
    expect(html).toContain("Conflict");
    expect(html).toContain("Legend");
    const boards = html.split('data-surface="theme-board"').slice(1);
    expect(boards).toHaveLength(2);
    for (const board of boards) {
      const primaries = board.match(/data-variant="primary"/g) ?? [];
      expect(primaries).toHaveLength(1);
    }
  });
});
