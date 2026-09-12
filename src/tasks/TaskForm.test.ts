import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY, WEEKDAY_OPTIONS } from "./copy";
import { TaskForm } from "./TaskForm";

function renderForm(
  props: Partial<{ open: boolean; initialRepeat: boolean }> = {},
): string {
  return renderToStaticMarkup(
    createElement(TaskForm, {
      open: true,
      onClose: () => undefined,
      initialRepeat: false,
      ...props,
    }),
  );
}

describe("TaskForm [D17] [D13] [D64]", () => {
  it("renders nothing when closed", () => {
    const html = renderForm({ open: false });
    expect(html).toBe("");
  });

  it("offers title, description, subtasks, Repeat, and source / creator", () => {
    const html = renderForm();
    expect(html).toContain(`${COPY.title} *`);
    expect(html).toContain(COPY.description);
    expect(html).toContain(COPY.subtasks);
    expect(html).toContain(COPY.repeat);
    expect(html).toContain(COPY.sourceCreator);
    expect(html).toContain(COPY.currentAccount);
    expect(html).toContain("local");
    expect(html).toContain(COPY.createTask);
    expect(html).toContain('data-variant="primary"');
  });

  it("hides the weekday selector until Repeat is on", () => {
    const off = renderForm({ initialRepeat: false });
    expect(off).not.toContain('data-weekday-selector="true"');
    for (const option of WEEKDAY_OPTIONS) {
      expect(off).not.toContain(`>${option.label}<`);
    }
    const on = renderForm({ initialRepeat: true });
    expect(on).toContain('data-weekday-selector="true"');
    for (const option of WEEKDAY_OPTIONS) {
      expect(on).toContain(`>${option.label}<`);
    }
    expect(on).not.toContain("Monthly");
    expect(on).not.toContain("Yearly");
    expect(on).not.toContain("every-N");
  });

  it("has no category, project, assignee, or workflow field", () => {
    const html = renderForm({ initialRepeat: true }).toLowerCase();
    expect(html).not.toContain("category");
    expect(html).not.toContain("project");
    expect(html).not.toContain("assignee");
    expect(html).not.toContain("workflow");
  });
});
