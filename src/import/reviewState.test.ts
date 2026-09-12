import { describe, expect, it } from "vitest";
import { sampleEnvelope } from "./sampleEnvelope";
import {
  addAnyway,
  buildReviewSession,
  moveItem,
  setItemSelected,
  validateSelected,
} from "./reviewState";

describe("review state [D62] [D15]", () => {
  it("Certain duplicate stays unselected until Add anyway", () => {
    const session = buildReviewSession(sampleEnvelope(), [
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
    ]);
    expect(session.items[0]?.selected).toBe(false);
    const ignored = setItemSelected(session, "item-1", true);
    expect(ignored.items[0]?.selected).toBe(false);
    const added = addAnyway(session, "item-1");
    expect(added.items[0]?.selected).toBe(true);
  });

  it("reorders with keyboard move up/down and writes order", () => {
    const envelope = sampleEnvelope({
      tasks: [
        {
          itemKey: "a",
          order: 0,
          title: "First",
          description: "First outcome.",
          subtasks: [],
        },
        {
          itemKey: "b",
          order: 1,
          title: "Second",
          description: "Second outcome.",
          subtasks: [],
        },
      ],
    });
    const session = buildReviewSession(envelope, []);
    const down = moveItem(session, "a", 1);
    expect(down.items.map((item) => item.itemKey)).toEqual(["b", "a"]);
    expect(down.items.map((item) => item.order)).toEqual([0, 1]);
    const up = moveItem(down, "a", -1);
    expect(up.items.map((item) => item.itemKey)).toEqual(["a", "b"]);
  });

  it("requires a selected task before confirm", () => {
    const session = buildReviewSession(sampleEnvelope(), []);
    const none = {
      ...session,
      items: session.items.map((item) => ({ ...item, selected: false })),
    };
    const valid = validateSelected(none);
    expect(valid.ok).toBe(false);
  });
});
