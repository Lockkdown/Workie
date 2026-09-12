import { describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import type { Task } from "../domain/types";
import { classifyDuplicates, reclassifyItem, toReviewItem } from "./duplicates";
import { sampleEnvelope } from "./sampleEnvelope";
import { normalizeText } from "./normalize";

const now = 1_000;

function localAi(
  itemKey: string,
  title: string,
  description: string,
  extras: Partial<Task> = {},
): Task {
  return {
    ...createTask({
      id: `local-${itemKey}`,
      title,
      description,
      now,
      source: {
        kind: "ai",
        sourceName: "Vault roadmap",
        sourceMark: "vault:roadmap",
        itemKey,
      },
    }).task,
    ...extras,
  };
}

function localUser(id: string, title: string, description: string): Task {
  return createTask({
    id,
    title,
    description,
    now,
    source: { kind: "user", accountId: "local" },
  }).task;
}

describe("duplicate detection [D15] [D62]", () => {
  it("marks the same sourceMark+itemKey as Certain duplicate", () => {
    const incoming = sampleEnvelope().tasks[0];
    expect(incoming).toBeDefined();
    if (!incoming) {
      return;
    }
    const classified = classifyDuplicates(incoming, "vault:roadmap", [
      localAi("item-1", "Write the spec", incoming.description),
    ]);
    expect(classified.duplicate).toBe("Certain duplicate");
    expect(classified.sourceMarkCertain).toBe(true);
  });

  it("marks fully normalised identical content as Certain duplicate", () => {
    const incoming = sampleEnvelope().tasks[0];
    expect(incoming).toBeDefined();
    if (!incoming) {
      return;
    }
    const classified = classifyDuplicates(incoming, "vault:roadmap", [
      localUser(
        "u1",
        "  WRITE   the Spec ",
        "Produce the locked spec from the source note.",
      ),
    ]);
    expect(classified.duplicate).toBe("Certain duplicate");
    expect(classified.sourceMarkCertain).toBe(false);
    expect(classified.contentCertain).toBe(true);
  });

  it("marks near titles as Possible duplicate when content differs", () => {
    const incoming = sampleEnvelope().tasks[0];
    expect(incoming).toBeDefined();
    if (!incoming) {
      return;
    }
    const classified = classifyDuplicates(incoming, "vault:roadmap", [
      localUser("u1", "Write the spec later", "A different body."),
    ]);
    expect(classified.duplicate).toBe("Possible duplicate");
    expect(classified.matchedTaskId).toBe("u1");
  });

  it("normalises with NFKC, lowercase, and collapsed whitespace", () => {
    expect(normalizeText("  Café\u00a0CAFE  ")).toBe("café cafe");
  });

  it("recomputes content detection and preserves source-mark certain", () => {
    const item = toReviewItem(
      {
        itemKey: "item-1",
        order: 0,
        title: "Write the spec",
        description: "Produce the locked spec from the source note.",
        subtasks: [],
      },
      "vault:roadmap",
      [localAi("item-1", "Old title", "Old description")],
    );
    expect(item.duplicate).toBe("Certain duplicate");
    expect(item.sourceMarkCertain).toBe(true);
    const edited = reclassifyItem(
      {
        ...item,
        title: "Brand new title",
        description: "Brand new description that matches nothing.",
      },
      "vault:roadmap",
      [localAi("item-1", "Old title", "Old description")],
    );
    expect(edited.sourceMarkCertain).toBe(true);
    expect(edited.duplicate).toBe("Certain duplicate");
    expect(edited.contentChanged).toBe(true);
  });
});
