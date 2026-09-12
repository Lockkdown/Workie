import type { ImportReviewDraftRecord, WorkieDB } from "../db/schema";
import { parseEnvelope } from "./envelope";
import { restoreReviewSession } from "./reviewState";
import { ACTIVE_DRAFT_ID, type ReviewItem, type ReviewSession } from "./types";

export type StoredReviewItem = {
  itemKey: string;
  order: number;
  title: string;
  description: string;
  subtasks: Array<{ title: string }>;
  selected: boolean;
};

type StoredPayload = {
  items: StoredReviewItem[];
  compareKeys: string[];
};

export function serializeSession(session: ReviewSession): StoredPayload {
  return {
    items: session.items.map((item) => ({
      itemKey: item.itemKey,
      order: item.order,
      title: item.title,
      description: item.description,
      subtasks: item.subtasks.map((entry) => ({ title: entry.title })),
      selected: item.selected,
    })),
    compareKeys: session.compareKeys,
  };
}

function parseStoredPayload(raw: string | undefined): StoredPayload {
  if (!raw) {
    return { items: [], compareKeys: [] };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      compareKeys: Array.isArray(parsed.compareKeys) ? parsed.compareKeys : [],
    };
  } catch {
    return { items: [], compareKeys: [] };
  }
}

export async function saveReviewDraft(
  db: WorkieDB,
  session: ReviewSession,
  now: number,
): Promise<void> {
  const existing = await db.importReviewDrafts.get(ACTIVE_DRAFT_ID);
  const row: ImportReviewDraftRecord = {
    id: ACTIVE_DRAFT_ID,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    envelopeJson: JSON.stringify(session.envelope),
    sourceName: session.sourceName,
    sourceMark: session.sourceMark,
    itemsJson: JSON.stringify(serializeSession(session)),
  };
  await db.importReviewDrafts.put(row);
}

export async function deleteReviewDraft(db: WorkieDB): Promise<void> {
  await db.importReviewDrafts.delete(ACTIVE_DRAFT_ID);
}

export type RestoreResult =
  | { ok: true; session: ReviewSession | undefined }
  | { ok: false; error: string; itemKey?: string };

export async function restoreReviewDraft(db: WorkieDB): Promise<RestoreResult> {
  const row = await db.importReviewDrafts.get(ACTIVE_DRAFT_ID);
  if (!row?.envelopeJson) {
    return { ok: true, session: undefined };
  }
  const parsed = parseEnvelope(row.envelopeJson);
  if (!parsed.ok) {
    return parsed;
  }
  const stored = parseStoredPayload(row.itemsJson);
  const locals = await db.tasks.toArray();
  const storedItems: ReviewItem[] = stored.items.map((item) => ({
    itemKey: item.itemKey,
    order: item.order,
    title: item.title,
    description: item.description,
    subtasks: item.subtasks,
    selected: item.selected,
    sourceMarkCertain: false,
    duplicate: "new",
    contentChanged: false,
  }));
  return {
    ok: true,
    session: restoreReviewSession(
      parsed.envelope,
      storedItems,
      locals,
      stored.compareKeys,
    ),
  };
}
