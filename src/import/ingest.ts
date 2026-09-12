import type { WorkieDB } from "../db/schema";
import { saveReviewDraft } from "./draft";
import { assertBatchFilename, parseEnvelope } from "./envelope";
import { buildReviewSession } from "./reviewState";
import type { ParseResult, ReviewSession } from "./types";

export type IngestResult =
  | { ok: true; session: ReviewSession }
  | { ok: false; error: string; itemKey?: string };

/** Read and validate only. Does not write IndexedDB [D97]. */
export function readBatchText(text: string, filename: string): ParseResult {
  const nameError = assertBatchFilename(filename);
  if (nameError) {
    return nameError;
  }
  return parseEnvelope(text);
}

/**
 * After a valid parse, open review by storing the draft (not a task) [D101].
 */
export async function ingestBatchFile(
  db: WorkieDB,
  file: File,
  now: number,
): Promise<IngestResult> {
  const text = await file.text();
  const parsed = readBatchText(text, file.name);
  if (!parsed.ok) {
    return parsed;
  }
  const locals = await db.tasks.toArray();
  const session = buildReviewSession(parsed.envelope, locals);
  await saveReviewDraft(db, session, now);
  return { ok: true, session };
}
