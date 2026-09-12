import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  COPY,
  RootErrorBoundary,
  RootErrorState,
  rootErrorCause,
} from "./RootErrorBoundary";

const here = dirname(fileURLToPath(import.meta.url));

function source(relative: string): string {
  return readFileSync(join(here, relative), "utf8");
}

function ThrowingChild(): ReactElement {
  throw new Error("The board could not render.");
}

describe("root error boundary [D91]", () => {
  it("shows cause, data-kept statement, and recovery action", () => {
    const html = renderToStaticMarkup(
      createElement(RootErrorState, {
        cause: "IndexedDB quota exceeded.",
        onReload: () => undefined,
      }),
    );
    expect(html).toContain("IndexedDB quota exceeded.");
    expect(html).toContain(COPY.dataKept);
    expect(html).toContain(COPY.reload);
    expect(html).toContain('data-state="error"');
    expect(html).toContain('role="alert"');
  });

  it("renders the error state instead of a blank page when a child throws", () => {
    let thrown: unknown;
    try {
      renderToStaticMarkup(createElement(ThrowingChild));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);

    const derived = RootErrorBoundary.getDerivedStateFromError(thrown);
    const boundary = new RootErrorBoundary({
      children: createElement(ThrowingChild),
    });
    boundary.state = derived;
    const html = renderToStaticMarkup(boundary.render() as ReactElement);

    expect(html).toContain("The board could not render.");
    expect(html).toContain(
      "All task, block and cycle data stays safe in IndexedDB. Nothing was lost.",
    );
    expect(html).toContain(">Reload<");
    expect(html).not.toContain("app-nav");
    expect(html).not.toContain("Daily Desk");
    expect(html).not.toContain("Plan Tomorrow");
    expect(html).not.toContain("Reports");
  });

  it("passes children through when nothing has thrown", () => {
    const html = renderToStaticMarkup(
      createElement(
        RootErrorBoundary,
        null,
        createElement("p", null, "Daily Desk ready"),
      ),
    );
    expect(html).toContain("Daily Desk ready");
    expect(html).not.toContain(COPY.dataKept);
    expect(html).not.toContain(COPY.reload);
  });

  it("states a literal cause for Error values", () => {
    expect(rootErrorCause(new Error("IndexedDB quota exceeded."))).toBe(
      "IndexedDB quota exceeded.",
    );
    expect(rootErrorCause("Theme could not be applied.")).toBe(
      "Theme could not be applied.",
    );
  });

  it("keeps application copy in English", () => {
    const values = Object.values(COPY).join(" ");
    expect(values).not.toMatch(
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
    );
    expect(COPY.reload).toBe("Reload");
    expect(COPY.dataKept).toBe(
      "All task, block and cycle data stays safe in IndexedDB. Nothing was lost.",
    );
  });

  it("wraps the app and bootstrap with the same error state", () => {
    const app = source("../App.tsx");
    const main = source("../main.tsx");
    expect(app).toContain("RootErrorBoundary");
    expect(app).toMatch(/<RootErrorBoundary>[\s\S]*<AppShell/);
    expect(main).toContain("RootErrorState");
    expect(main).toContain("rootErrorCause");
    expect(main).toMatch(/catch \(error\)/);
  });
});
