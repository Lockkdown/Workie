import { describe, expect, it } from "vitest";
import { parseEnvelope } from "./envelope";
import { readBatchText } from "./ingest";
import { sampleEnvelope } from "./sampleEnvelope";
import { BATCH_FILENAME } from "./types";

const EXCLUDED = [
  "status",
  "calendarBlock",
  "completion",
  "deadline",
  "suggestedDuration",
  "dependency",
  "completionCriteria",
  "sourceExcerpt",
  "metadata",
];

describe("import envelope [D59] [D97]", () => {
  it("accepts the exact allowlist including empty subtasks", () => {
    const parsed = parseEnvelope(JSON.stringify(sampleEnvelope()));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.tasks[0]?.subtasks).toEqual([]);
    }
  });

  it("rejects an unsupported version", () => {
    const parsed = parseEnvelope(
      JSON.stringify(sampleEnvelope({ version: "workie-batch.v2" as never })),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/Unsupported version: workie-batch.v2/);
    }
  });

  it("rejects unknown envelope and task fields", () => {
    for (const field of EXCLUDED) {
      const root = parseEnvelope(
        JSON.stringify({ ...sampleEnvelope(), [field]: 1 }),
      );
      expect(root.ok, field).toBe(false);
      if (!root.ok) {
        expect(root.error).toBe(`Unknown field: ${field}.`);
      }
      const envelope = sampleEnvelope();
      const task = envelope.tasks[0];
      expect(task).toBeDefined();
      if (!task) {
        continue;
      }
      const nested = parseEnvelope(
        JSON.stringify({
          ...envelope,
          tasks: [{ ...task, [field]: 1 }],
        }),
      );
      expect(nested.ok, `task.${field}`).toBe(false);
      if (!nested.ok) {
        expect(nested.error).toBe(`Unknown field: ${field}.`);
      }
    }
  });

  it("rejects an extra key on a subtask", () => {
    const envelope = sampleEnvelope({
      tasks: [
        {
          itemKey: "item-1",
          order: 0,
          title: "Write the spec",
          description: "Produce the locked spec from the source note.",
          subtasks: [{ title: "Step", done: true } as never],
        },
      ],
    });
    const parsed = parseEnvelope(JSON.stringify(envelope));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toBe("Unknown field: done.");
    }
  });

  it("rejects the wrong filename without interpreting the body", () => {
    const result = readBatchText(
      JSON.stringify(sampleEnvelope()),
      "other.json",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(BATCH_FILENAME);
    }
  });

  it("does not invent filler subtasks", () => {
    const parsed = parseEnvelope(
      JSON.stringify(
        sampleEnvelope({
          tasks: [
            {
              itemKey: "bare",
              order: 1,
              title: "Nearest boundary",
              description: "The source has no natural steps.",
              subtasks: [],
            },
          ],
        }),
      ),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.tasks[0]?.subtasks).toEqual([]);
    }
  });
});
