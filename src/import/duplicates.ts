import type { Task } from "../domain/types";
import { contentFingerprint, titlesPossiblyDuplicate } from "./normalize";
import type { DuplicateLevel, EnvelopeTask, ReviewItem } from "./types";

function subtaskTitlesOf(task: {
  subtasks: readonly { title: string }[];
}): string[] {
  return task.subtasks.map((item) => item.title);
}

function fingerprintOf(task: {
  title: string;
  description: string;
  subtasks: readonly { title: string }[];
}): string {
  return contentFingerprint(
    task.title,
    task.description,
    subtaskTitlesOf(task),
  );
}

function isSourceMarkMatch(
  local: Task,
  sourceMark: string,
  itemKey: string,
): boolean {
  return (
    local.source.kind === "ai" &&
    local.source.sourceMark === sourceMark &&
    local.source.itemKey === itemKey
  );
}

export type Classification = {
  duplicate: DuplicateLevel;
  sourceMarkCertain: boolean;
  contentCertain: boolean;
  contentChanged: boolean;
  matchedTaskId?: string;
  localTitle?: string;
  localDescription?: string;
  localSubtaskTitles?: string[];
};

function snapshot(
  local: Task,
): Pick<
  Classification,
  "matchedTaskId" | "localTitle" | "localDescription" | "localSubtaskTitles"
> {
  return {
    matchedTaskId: local.id,
    localTitle: local.title,
    localDescription: local.description ?? "",
    localSubtaskTitles: subtaskTitlesOf(local),
  };
}

/**
 * Certain: same sourceMark+itemKey, or fully normalised content identical.
 * Possible: not certain, and normalised titles equal or one contains the other.
 * Source-mark certain is preserved across content edits [D15] [D62].
 */
export function classifyDuplicates(
  incoming: Pick<
    EnvelopeTask,
    "itemKey" | "title" | "description" | "subtasks"
  >,
  sourceMark: string,
  locals: readonly Task[],
  preservedSourceMarkCertain?: boolean,
): Classification {
  const sourceMarkCertain =
    preservedSourceMarkCertain === true ||
    locals.some((local) =>
      isSourceMarkMatch(local, sourceMark, incoming.itemKey),
    );
  const incomingPrint = fingerprintOf({
    title: incoming.title,
    description: incoming.description,
    subtasks: incoming.subtasks,
  });

  const markMatch = locals.find((local) =>
    isSourceMarkMatch(local, sourceMark, incoming.itemKey),
  );
  const contentMatch = locals.find(
    (local) =>
      fingerprintOf({
        title: local.title,
        description: local.description ?? "",
        subtasks: local.subtasks,
      }) === incomingPrint,
  );
  const possibleMatch = locals.find((local) =>
    titlesPossiblyDuplicate(incoming.title, local.title),
  );

  const contentCertain = contentMatch !== undefined;
  const matched = markMatch ?? contentMatch ?? possibleMatch;
  const contentChanged =
    markMatch !== undefined &&
    fingerprintOf({
      title: markMatch.title,
      description: markMatch.description ?? "",
      subtasks: markMatch.subtasks,
    }) !== incomingPrint;

  const duplicate: DuplicateLevel =
    sourceMarkCertain || contentCertain
      ? "Certain duplicate"
      : possibleMatch !== undefined
        ? "Possible duplicate"
        : "new";

  return {
    duplicate,
    sourceMarkCertain,
    contentCertain,
    contentChanged,
    ...(matched ? snapshot(matched) : {}),
  };
}

export function toReviewItem(
  task: EnvelopeTask,
  sourceMark: string,
  locals: readonly Task[],
  extras?: { selected?: boolean; sourceMarkCertain?: boolean },
): ReviewItem {
  const classified = classifyDuplicates(
    task,
    sourceMark,
    locals,
    extras?.sourceMarkCertain,
  );
  const selected =
    extras?.selected ?? classified.duplicate !== "Certain duplicate";
  return {
    itemKey: task.itemKey,
    order: task.order,
    title: task.title,
    description: task.description,
    subtasks: task.subtasks.map((item) => ({ title: item.title })),
    selected,
    sourceMarkCertain: classified.sourceMarkCertain,
    duplicate: classified.duplicate,
    contentChanged: classified.contentChanged,
    matchedTaskId: classified.matchedTaskId,
    localTitle: classified.localTitle,
    localDescription: classified.localDescription,
    localSubtaskTitles: classified.localSubtaskTitles,
  };
}

export function reclassifyItem(
  item: ReviewItem,
  sourceMark: string,
  locals: readonly Task[],
): ReviewItem {
  return toReviewItem(
    {
      itemKey: item.itemKey,
      order: item.order,
      title: item.title,
      description: item.description,
      subtasks: item.subtasks,
    },
    sourceMark,
    locals,
    {
      selected: item.selected,
      sourceMarkCertain: item.sourceMarkCertain,
    },
  );
}
