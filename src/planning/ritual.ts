import {
  createDayPlan,
  evaluateOverload,
  isTaskBlock,
  packDay,
  scheduleTask,
  type DayPlan,
  type MutationPreview,
} from "../calendar/index";
import { parseWorkieDayStart } from "../domain/workieDay";
import type { BlockOwner, PlanningDocument, TrayItem } from "./types";

export function emptyDocument(day: string, now: number): PlanningDocument {
  return {
    day,
    commitState: "draft",
    step: 1,
    selectedIds: [],
    keepAnyway: false,
    plan: createDayPlan(day),
    owners: [],
    revisions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function toggleSelected(
  doc: PlanningDocument,
  entityId: string,
  now: number,
): PlanningDocument {
  const selected = doc.selectedIds.includes(entityId)
    ? doc.selectedIds.filter((id) => id !== entityId)
    : [...doc.selectedIds, entityId];
  return { ...doc, selectedIds: selected, updatedAt: now };
}

export function setStep(
  doc: PlanningDocument,
  step: 1 | 2 | 3,
  now: number,
): PlanningDocument {
  return { ...doc, step, updatedAt: now };
}

export function isCommitment(doc: PlanningDocument, entityId: string): boolean {
  if (!doc.selectedIds.includes(entityId)) {
    return false;
  }
  return doc.owners.some((owner) => owner.entityId === entityId);
}

export function commitmentEntityIds(doc: PlanningDocument): string[] {
  return doc.selectedIds.filter((id) => isCommitment(doc, id));
}

export function placedBlocksForCommit(doc: PlanningDocument): DayPlan {
  const allowed = new Set(
    doc.owners
      .filter((owner) => doc.selectedIds.includes(owner.entityId))
      .map((owner) => owner.blockId),
  );
  return {
    ...doc.plan,
    blocks: doc.plan.blocks.filter((block) => allowed.has(block.id)),
  };
}

export function placeFixed(input: {
  doc: PlanningDocument;
  item: TrayItem;
  blockId: string;
  startHour: number;
  startMinute: number;
  durationMs: number;
  now: number;
}): { doc: PlanningDocument; preview: MutationPreview } {
  const startMs =
    parseWorkieDayStart(input.doc.day) +
    input.startHour * 3_600_000 +
    input.startMinute * 60_000;
  const preview = scheduleTask(
    input.doc.plan,
    {
      id: input.blockId,
      taskId: input.item.taskId,
      type: "fixed",
      startMs,
      endMs: startMs + input.durationMs,
    },
    { confirmed: false },
  );
  return applyPlacement(input.doc, input.item.id, preview, input.now);
}

export function placeFlexible(input: {
  doc: PlanningDocument;
  item: TrayItem;
  blockId: string;
  durationMs: number;
  precedingAnchorId: string | null;
  chainPosition: number;
  now: number;
}): { doc: PlanningDocument; preview: MutationPreview } {
  const preview = scheduleTask(
    input.doc.plan,
    {
      id: input.blockId,
      taskId: input.item.taskId,
      type: "flexible",
      durationMs: input.durationMs,
      precedingAnchorId: input.precedingAnchorId,
      chainPosition: input.chainPosition,
    },
    { confirmed: false },
  );
  return applyPlacement(input.doc, input.item.id, preview, input.now);
}

function applyPlacement(
  doc: PlanningDocument,
  entityId: string,
  preview: MutationPreview,
  now: number,
): { doc: PlanningDocument; preview: MutationPreview } {
  const newIds = preview.next.blocks
    .map((block) => block.id)
    .filter((id) => !doc.plan.blocks.some((block) => block.id === id));
  const owners: BlockOwner[] = [
    ...doc.owners,
    ...newIds.map((blockId) => ({ blockId, entityId })),
  ];
  return {
    preview,
    doc: {
      ...doc,
      plan: preview.next,
      owners,
      keepAnyway: false,
      updatedAt: now,
    },
  };
}

export function confirmPlacement(
  doc: PlanningDocument,
  preview: MutationPreview,
  now: number,
): PlanningDocument {
  return {
    ...doc,
    plan: preview.next,
    updatedAt: now,
  };
}

export function markKeepAnyway(
  doc: PlanningDocument,
  now: number,
): PlanningDocument {
  return { ...doc, keepAnyway: true, updatedAt: now };
}

export function needsKeepAnyway(doc: PlanningDocument): boolean {
  const commitPlan = placedBlocksForCommit(doc);
  const overload = evaluateOverload(commitPlan);
  const packed = packDay(commitPlan);
  const conflicted = packed.blocks.some((block) => block.conflict);
  return overload.overloaded || conflicted;
}

export function mayCommit(doc: PlanningDocument): boolean {
  if (!needsKeepAnyway(doc)) {
    return true;
  }
  return doc.keepAnyway;
}

export function commitDocument(
  doc: PlanningDocument,
  now: number,
): PlanningDocument {
  return {
    ...doc,
    commitState: "committed",
    plan: placedBlocksForCommit(doc),
    keepAnyway: doc.keepAnyway,
    updatedAt: now,
  };
}

export function applyRevision(
  doc: PlanningDocument,
  nextPlan: DayPlan,
  revisionId: string,
  now: number,
): PlanningDocument {
  if (doc.commitState !== "committed") {
    return { ...doc, plan: nextPlan, updatedAt: now };
  }
  return {
    ...doc,
    commitState: "committed",
    plan: nextPlan,
    revisions: [...doc.revisions, { id: revisionId, at: now }],
    updatedAt: now,
  };
}

export function statusesUnchanged(): true {
  return true;
}

export function taskBlocksOf(plan: DayPlan) {
  return plan.blocks.filter(isTaskBlock);
}
