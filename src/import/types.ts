export const BATCH_FILENAME = "workie-batch.v1.json";
export const BATCH_VERSION = "workie-batch.v1";
export const ACTIVE_DRAFT_ID = "active";

export type EnvelopeSubtask = {
  title: string;
};

export type EnvelopeTask = {
  itemKey: string;
  order: number;
  title: string;
  description: string;
  subtasks: EnvelopeSubtask[];
};

export type BatchEnvelope = {
  version: typeof BATCH_VERSION;
  sourceName: string;
  sourceMark: string;
  tasks: EnvelopeTask[];
};

export type DuplicateLevel = "new" | "Possible duplicate" | "Certain duplicate";

export type ReviewItem = {
  itemKey: string;
  order: number;
  title: string;
  description: string;
  subtasks: EnvelopeSubtask[];
  selected: boolean;
  sourceMarkCertain: boolean;
  duplicate: DuplicateLevel;
  matchedTaskId?: string;
  contentChanged: boolean;
  localTitle?: string;
  localDescription?: string;
  localSubtaskTitles?: string[];
};

export type ReviewSession = {
  envelope: BatchEnvelope;
  sourceName: string;
  sourceMark: string;
  items: ReviewItem[];
  compareKeys: string[];
};

export type ParseFailure = {
  ok: false;
  error: string;
  itemKey?: string;
};

export type ParseSuccess = {
  ok: true;
  envelope: BatchEnvelope;
};

export type ParseResult = ParseSuccess | ParseFailure;
