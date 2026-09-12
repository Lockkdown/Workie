import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShellView } from "../shell/AppShell";
import { DEFAULT_DESK_MODE, DEFAULT_DESTINATION } from "../shell/destinations";
import { DEFAULT_THEME } from "../shell/theme";
import { COPY } from "./copy";
import { sampleEnvelope } from "./sampleEnvelope";
import { ImportReviewView, type ImportReviewViewProps } from "./ImportReview";
import { buildReviewSession } from "./reviewState";

const noop = () => undefined;

function reviewProps(
  overrides: Partial<ImportReviewViewProps> = {},
): ImportReviewViewProps {
  return {
    session: buildReviewSession(sampleEnvelope(), []),
    online: true,
    loading: false,
    discardConfirming: false,
    committing: false,
    onTitle: noop,
    onDescription: noop,
    onSelect: noop,
    onAddAnyway: noop,
    onCompare: noop,
    onMove: noop,
    onAddSubtask: noop,
    onEditSubtask: noop,
    onRemoveSubtask: noop,
    onConfirm: noop,
    onDiscard: noop,
    onKeepReview: noop,
    onConfirmDiscard: noop,
    ...overrides,
  };
}

describe("import review UI [D62] [D85] [D88] [D91]", () => {
  it("shows source, Claude Cowork, content, and one primary confirm", () => {
    const html = renderToStaticMarkup(
      createElement(ImportReviewView, reviewProps()),
    );
    expect(html).toContain(COPY.reviewTitle);
    expect(html).toContain("Vault roadmap");
    expect(html).toContain(COPY.claudeCowork);
    expect(html).toContain("vault:roadmap");
    expect(html).toContain("Write the spec");
    expect(html).toContain('role="dialog"');
    expect(html.match(/data-variant="primary"/g)).toHaveLength(1);
    expect(html).toContain(COPY.confirm);
    expect(html).not.toMatch(/\bSplit\b/);
    expect(html).not.toMatch(/\bMerge\b/);
    expect(html).not.toMatch(/\bStreak\b/);
    expect(html).not.toMatch(/\bChallenge\b/);
    expect(html).not.toMatch(/\bCategory\b/);
    expect(html).not.toMatch(/>Focus</);
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('name="sourceMark"');
    expect(html).not.toContain('id="import-source-mark"');
  });

  it("renders duplicate state as label plus icon plus accent", () => {
    const html = renderToStaticMarkup(
      createElement(
        ImportReviewView,
        reviewProps({
          session: buildReviewSession(sampleEnvelope(), [
            {
              kind: "task",
              id: "existing",
              title: "Write the spec",
              description: "Produce the locked spec from the source note.",
              subtasks: [],
              status: "Waiting",
              source: {
                kind: "ai",
                sourceName: "Vault roadmap",
                sourceMark: "vault:roadmap",
                itemKey: "item-1",
              },
              createdAt: 1,
              updatedAt: 1,
              blockIds: [],
              focusHistory: [],
            },
          ]),
        }),
      ),
    );
    expect(html).toContain(COPY.certainDuplicate);
    expect(html).toContain(COPY.addAnyway);
    expect(html).toContain('data-icon="duplicate-certain"');
    expect(html).toContain("import-dup-accent");
    expect(html).toContain('disabled=""');
  });

  it("shows empty, loading, error, offline, and partial states", () => {
    const shell = renderToStaticMarkup(
      createElement(ShellView, {
        destination: DEFAULT_DESTINATION,
        mode: DEFAULT_DESK_MODE,
        theme: DEFAULT_THEME,
        trayCollapsed: false,
        onDestination: noop,
        onMode: noop,
        onTheme: noop,
        onTrayCollapsed: noop,
      }),
    );
    expect(shell).toContain(COPY.importBatch);
    expect(shell).toContain(COPY.dropHint);
    expect(shell).toContain('data-state="empty"');
    expect(shell).toContain('accept=".json"');
    expect(shell.match(/aria-label="App"/g)).toHaveLength(1);
    expect(shell).not.toContain('aria-current="page">Import');

    const loading = renderToStaticMarkup(
      createElement(ImportReviewView, reviewProps({ loading: true })),
    );
    expect(loading).toContain('data-state="loading"');
    expect(loading).toContain(COPY.loading);

    const errored = renderToStaticMarkup(
      createElement(
        ImportReviewView,
        reviewProps({ error: "Task item-1: title is required." }),
      ),
    );
    expect(errored).toContain('role="alert"');
    expect(errored).toContain("Task item-1: title is required.");

    const offline = renderToStaticMarkup(
      createElement(ImportReviewView, reviewProps({ online: false })),
    );
    expect(offline).toContain('data-offline="true"');
    expect(offline).toContain(COPY.offline);
    expect(offline).toContain('data-icon="offline"');
    expect(offline).toContain(COPY.saveStateOffline);

    const session = buildReviewSession(sampleEnvelope(), []);
    const partialSession = {
      ...session,
      items: session.items.map((item) => ({ ...item, title: "" })),
    };
    const partial = renderToStaticMarkup(
      createElement(ImportReviewView, reviewProps({ session: partialSession })),
    );
    expect(partial).toContain('data-partial="true"');
    expect(partial).toContain("title is required");
  });
});
