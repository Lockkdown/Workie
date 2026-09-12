import { BATCH_VERSION, type BatchEnvelope } from "./types";

export function sampleEnvelope(
  overrides: Partial<BatchEnvelope> & {
    tasks?: BatchEnvelope["tasks"];
  } = {},
): BatchEnvelope {
  return {
    version: BATCH_VERSION,
    sourceName: "Vault roadmap",
    sourceMark: "vault:roadmap",
    tasks: [
      {
        itemKey: "item-1",
        order: 0,
        title: "Write the spec",
        description: "Produce the locked spec from the source note.",
        subtasks: [],
      },
    ],
    ...overrides,
  };
}
