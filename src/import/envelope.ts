import { COPY } from "./copy";
import {
  BATCH_FILENAME,
  BATCH_VERSION,
  type BatchEnvelope,
  type EnvelopeSubtask,
  type EnvelopeTask,
  type ParseFailure,
  type ParseResult,
} from "./types";

const ENVELOPE_KEYS = new Set(["version", "sourceName", "sourceMark", "tasks"]);
const TASK_KEYS = new Set([
  "itemKey",
  "order",
  "title",
  "description",
  "subtasks",
]);
const SUBTASK_KEYS = new Set(["title"]);

function unknownField(key: string): ParseFailure {
  return { ok: false, error: `Unknown field: ${key}.` };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstUnknownKey(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): string | undefined {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return key;
    }
  }
  return undefined;
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  itemKey?: string,
): { ok: true; value: string } | ParseFailure {
  const value = record[key];
  if (typeof value !== "string") {
    return {
      ok: false,
      error: itemKey
        ? `Task ${itemKey}: ${key} must be a string.`
        : `${key} must be a string.`,
      itemKey,
    };
  }
  if (value.trim().length === 0) {
    return {
      ok: false,
      error: itemKey
        ? `Task ${itemKey}: ${key} is required.`
        : `${key} is required.`,
      itemKey,
    };
  }
  return { ok: true, value };
}

function parseSubtask(
  value: unknown,
  itemKey: string,
  index: number,
): { ok: true; subtask: EnvelopeSubtask } | ParseFailure {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: `Task ${itemKey}: subtask ${String(index)} must be an object.`,
      itemKey,
    };
  }
  const extra = firstUnknownKey(value, SUBTASK_KEYS);
  if (extra !== undefined) {
    return unknownField(extra);
  }
  const title = requireNonEmptyString(value, "title", itemKey);
  if (!title.ok) {
    return title;
  }
  return { ok: true, subtask: { title: title.value } };
}

function parseTask(
  value: unknown,
  index: number,
): { ok: true; task: EnvelopeTask } | ParseFailure {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: `Task at index ${String(index)} must be an object.`,
    };
  }
  const extra = firstUnknownKey(value, TASK_KEYS);
  if (extra !== undefined) {
    return unknownField(extra);
  }
  const itemKeyResult = requireNonEmptyString(value, "itemKey");
  if (!itemKeyResult.ok) {
    return {
      ok: false,
      error: `Task at index ${String(index)}: itemKey is required.`,
    };
  }
  const itemKey = itemKeyResult.value;
  const order = value.order;
  if (typeof order !== "number" || !Number.isInteger(order)) {
    return {
      ok: false,
      error: `Task ${itemKey}: order must be an integer.`,
      itemKey,
    };
  }
  const title = requireNonEmptyString(value, "title", itemKey);
  if (!title.ok) {
    return title;
  }
  const description = requireNonEmptyString(value, "description", itemKey);
  if (!description.ok) {
    return description;
  }
  if (!Array.isArray(value.subtasks)) {
    return {
      ok: false,
      error: `Task ${itemKey}: subtasks must be an array.`,
      itemKey,
    };
  }
  const subtasks: EnvelopeSubtask[] = [];
  for (const [subIndex, entry] of value.subtasks.entries()) {
    const parsed = parseSubtask(entry, itemKey, subIndex);
    if (!parsed.ok) {
      return parsed;
    }
    subtasks.push(parsed.subtask);
  }
  return {
    ok: true,
    task: {
      itemKey,
      order,
      title: title.value,
      description: description.value,
      subtasks,
    },
  };
}

export function assertBatchFilename(name: string): ParseFailure | undefined {
  const base = name.split(/[/\\]/).pop() ?? name;
  if (base !== BATCH_FILENAME) {
    return {
      ok: false,
      error: `${COPY.expectedFilename} Got ${base}.`,
    };
  }
  return undefined;
}

/** Exact allowlist. Unknown keys and unsupported versions are rejected [D97]. */
export function parseEnvelope(text: string): ParseResult {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, error: "Batch must be a JSON object." };
  }
  const extra = firstUnknownKey(parsed, ENVELOPE_KEYS);
  if (extra !== undefined) {
    return unknownField(extra);
  }
  const version = parsed.version;
  if (typeof version !== "string") {
    return { ok: false, error: "Missing version." };
  }
  if (version !== BATCH_VERSION) {
    return { ok: false, error: `Unsupported version: ${version}.` };
  }
  const sourceName = requireNonEmptyString(parsed, "sourceName");
  if (!sourceName.ok) {
    return sourceName;
  }
  const sourceMark = requireNonEmptyString(parsed, "sourceMark");
  if (!sourceMark.ok) {
    return sourceMark;
  }
  if (!Array.isArray(parsed.tasks)) {
    return { ok: false, error: "tasks must be an array." };
  }
  const tasks: EnvelopeTask[] = [];
  for (const [index, entry] of parsed.tasks.entries()) {
    const task = parseTask(entry, index);
    if (!task.ok) {
      return task;
    }
    tasks.push(task.task);
  }
  const envelope: BatchEnvelope = {
    version: BATCH_VERSION,
    sourceName: sourceName.value,
    sourceMark: sourceMark.value,
    tasks,
  };
  return { ok: true, envelope };
}
