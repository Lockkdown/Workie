import type { Task } from "../domain/types";
import { reclassifyItem, toReviewItem } from "./duplicates";
import type { BatchEnvelope, ReviewItem, ReviewSession } from "./types";

export function buildReviewSession(
  envelope: BatchEnvelope,
  locals: readonly Task[],
): ReviewSession {
  const items = [...envelope.tasks]
    .sort((a, b) => a.order - b.order || a.itemKey.localeCompare(b.itemKey))
    .map((task) => toReviewItem(task, envelope.sourceMark, locals));
  return {
    envelope,
    sourceName: envelope.sourceName,
    sourceMark: envelope.sourceMark,
    items,
    compareKeys: items
      .filter((item) => item.duplicate === "Possible duplicate")
      .map((item) => item.itemKey),
  };
}

export function restoreReviewSession(
  envelope: BatchEnvelope,
  storedItems: readonly ReviewItem[],
  locals: readonly Task[],
  compareKeys: readonly string[],
): ReviewSession {
  const byKey = new Map(storedItems.map((item) => [item.itemKey, item]));
  const items = [...envelope.tasks]
    .sort((a, b) => a.order - b.order || a.itemKey.localeCompare(b.itemKey))
    .map((task) => {
      const stored = byKey.get(task.itemKey);
      const merged: ReviewItem = toReviewItem(
        {
          itemKey: task.itemKey,
          order: stored?.order ?? task.order,
          title: stored?.title ?? task.title,
          description: stored?.description ?? task.description,
          subtasks: stored?.subtasks ?? task.subtasks,
        },
        envelope.sourceMark,
        locals,
      );
      return {
        ...merged,
        selected: stored?.selected ?? merged.selected,
      };
    })
    .sort((a, b) => a.order - b.order || a.itemKey.localeCompare(b.itemKey));
  return {
    envelope,
    sourceName: envelope.sourceName,
    sourceMark: envelope.sourceMark,
    items,
    compareKeys: [...compareKeys],
  };
}

function replaceItem(
  session: ReviewSession,
  itemKey: string,
  update: (item: ReviewItem) => ReviewItem,
): ReviewSession {
  return {
    ...session,
    items: session.items.map((item) =>
      item.itemKey === itemKey ? update(item) : item,
    ),
  };
}

export function editItemContent(
  session: ReviewSession,
  itemKey: string,
  patch: Partial<Pick<ReviewItem, "title" | "description" | "subtasks">>,
  locals: readonly Task[],
): ReviewSession {
  return replaceItem(session, itemKey, (item) =>
    reclassifyItem({ ...item, ...patch }, session.sourceMark, locals),
  );
}

export function setItemSelected(
  session: ReviewSession,
  itemKey: string,
  selected: boolean,
): ReviewSession {
  return replaceItem(session, itemKey, (item) => {
    if (selected && item.duplicate === "Certain duplicate" && !item.selected) {
      return item;
    }
    return { ...item, selected };
  });
}

export function addAnyway(
  session: ReviewSession,
  itemKey: string,
): ReviewSession {
  return replaceItem(session, itemKey, (item) => ({
    ...item,
    selected: true,
  }));
}

export function moveItem(
  session: ReviewSession,
  itemKey: string,
  direction: -1 | 1,
): ReviewSession {
  const index = session.items.findIndex((item) => item.itemKey === itemKey);
  if (index < 0) {
    return session;
  }
  const target = index + direction;
  if (target < 0 || target >= session.items.length) {
    return session;
  }
  const items = [...session.items];
  const current = items[index];
  const swap = items[target];
  if (!current || !swap) {
    return session;
  }
  items[index] = swap;
  items[target] = current;
  return {
    ...session,
    items: items.map((item, order) => ({ ...item, order })),
  };
}

export function addSubtaskRow(
  session: ReviewSession,
  itemKey: string,
  locals: readonly Task[],
): ReviewSession {
  return replaceItem(session, itemKey, (item) =>
    reclassifyItem(
      { ...item, subtasks: [...item.subtasks, { title: "" }] },
      session.sourceMark,
      locals,
    ),
  );
}

export function editSubtaskRow(
  session: ReviewSession,
  itemKey: string,
  index: number,
  title: string,
  locals: readonly Task[],
): ReviewSession {
  return replaceItem(session, itemKey, (item) =>
    reclassifyItem(
      {
        ...item,
        subtasks: item.subtasks.map((entry, i) =>
          i === index ? { title } : entry,
        ),
      },
      session.sourceMark,
      locals,
    ),
  );
}

export function removeSubtaskRow(
  session: ReviewSession,
  itemKey: string,
  index: number,
  locals: readonly Task[],
): ReviewSession {
  return replaceItem(session, itemKey, (item) =>
    reclassifyItem(
      {
        ...item,
        subtasks: item.subtasks.filter((_, i) => i !== index),
      },
      session.sourceMark,
      locals,
    ),
  );
}

export function toggleCompare(
  session: ReviewSession,
  itemKey: string,
): ReviewSession {
  const has = session.compareKeys.includes(itemKey);
  return {
    ...session,
    compareKeys: has
      ? session.compareKeys.filter((key) => key !== itemKey)
      : [...session.compareKeys, itemKey],
  };
}

export type SelectedValidation =
  { ok: true } | { ok: false; error: string; itemKey?: string };

export function validateSelected(session: ReviewSession): SelectedValidation {
  const selected = session.items.filter((item) => item.selected);
  if (selected.length === 0) {
    return {
      ok: false,
      error: "Select at least one task to import.",
    };
  }
  for (const item of selected) {
    if (item.title.trim().length === 0) {
      return {
        ok: false,
        error: `Task ${item.itemKey}: title is required.`,
        itemKey: item.itemKey,
      };
    }
    if (item.description.trim().length === 0) {
      return {
        ok: false,
        error: `Task ${item.itemKey}: description is required.`,
        itemKey: item.itemKey,
      };
    }
  }
  return { ok: true };
}

export function itemPartialError(
  session: ReviewSession,
  itemKey: string,
): string | undefined {
  const item = session.items.find((entry) => entry.itemKey === itemKey);
  if (!item?.selected) {
    return undefined;
  }
  if (item.title.trim().length === 0) {
    return `Task ${item.itemKey}: title is required.`;
  }
  if (item.description.trim().length === 0) {
    return `Task ${item.itemKey}: description is required.`;
  }
  return undefined;
}
