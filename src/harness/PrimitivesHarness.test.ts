import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIELD_CONTROLS, PrimitivesHarness } from "./PrimitivesHarness";

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

  it("renders all seven field chrome controls in both themes [D103]", () => {
    const html = renderToStaticMarkup(createElement(PrimitivesHarness));
    expect(html).toContain('data-concept="field-chrome"');
    expect(FIELD_CONTROLS).toEqual([
      "text",
      "textarea",
      "select",
      "checkbox",
      "radio",
      "number",
      "file",
    ]);
    const boards = html.split('data-surface="theme-board"').slice(1);
    expect(boards).toHaveLength(2);
    for (const board of boards) {
      for (const control of FIELD_CONTROLS) {
        expect(board).toContain(`data-control="${control}"`);
      }
      expect(board).toContain(">Title<");
      expect(board).toContain('placeholder="Add a title"');
      expect(board).toContain('aria-invalid="true"');
      expect(board).toContain('data-field-state="invalid"');
      expect(board).toContain(">Invalid<");
      expect(board).toContain("disabled");
      expect(board).toContain('data-field-state="disabled"');
      expect(board).toContain(">Disabled<");
      expect(board).toContain("<legend");
      expect(board).toContain("More actions");
      expect(board).toContain("<details");
      expect(board).toContain('data-scroll="harness"');
    }
  });

  it("does not promise OS chrome looks or reads like Workie [D103] [D104]", () => {
    const html = renderToStaticMarkup(createElement(PrimitivesHarness));
    expect(html).not.toMatch(/open (dropdown|select|list).{0,40}Workie/i);
    expect(html).not.toMatch(/file picker.{0,40}Workie/i);
    expect(html).not.toMatch(/notification prompt.{0,40}Workie/i);
  });
});
