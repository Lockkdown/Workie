import {
  type CalendarBlock,
  type ChainId,
  type DayPlan,
  type MutationPreview,
  type PackedDay,
  convertType,
  createReserve,
  dragEdge,
  dragFixedBody,
  dragFlexibleBody,
  isFlexibleBlock,
  isFixedBlock,
  isReserveBlock,
  packDay,
  resolveConflict,
  scheduleTask,
  unschedule,
} from "../calendar/index";
import { parseTaskDrag, type TaskDragPayload } from "../desk/taskDrag";
import { DEFAULT_DURATION_MS } from "./constants";
import { COPY } from "./copy";
import { formatSpan } from "./format";
import { flexiblePlacementAt } from "./placement";

export type ScheduleKind = "task" | "reserve";

export type ScheduleDraft = {
  kind: ScheduleKind;
  taskId?: string;
  type: "fixed" | "flexible" | null;
  startMs: number;
  durationMs: number;
  precedingAnchorId: ChainId;
  chainPosition: number;
  id: string;
};

export function previewFromDraft(
  plan: DayPlan,
  draft: ScheduleDraft,
): MutationPreview | null {
  if (draft.type === null) {
    return null;
  }
  if (draft.kind === "task") {
    const taskId = draft.taskId;
    if (taskId === undefined) {
      return null;
    }
    if (draft.type === "fixed") {
      return scheduleTask(
        plan,
        {
          id: draft.id,
          taskId,
          type: "fixed",
          startMs: draft.startMs,
          endMs: draft.startMs + draft.durationMs,
        },
        { confirmed: false },
      );
    }
    return scheduleTask(
      plan,
      {
        id: draft.id,
        taskId,
        type: "flexible",
        durationMs: draft.durationMs,
        precedingAnchorId: draft.precedingAnchorId,
        chainPosition: draft.chainPosition,
      },
      { confirmed: false },
    );
  }
  if (draft.type === "fixed") {
    return createReserve(
      plan,
      {
        id: draft.id,
        type: "fixed",
        startMs: draft.startMs,
        endMs: draft.startMs + draft.durationMs,
      },
      { confirmed: false },
    );
  }
  return createReserve(
    plan,
    {
      id: draft.id,
      type: "flexible",
      durationMs: draft.durationMs,
      precedingAnchorId: draft.precedingAnchorId,
      chainPosition: draft.chainPosition,
    },
    { confirmed: false },
  );
}

export function previewScheduleFromDrop(
  plan: DayPlan,
  payload: TaskDragPayload,
  type: "fixed" | "flexible",
  slot: {
    startMs: number;
    durationMs?: number;
    precedingAnchorId: ChainId;
    chainPosition: number;
  },
  id: string,
): MutationPreview {
  const durationMs = slot.durationMs ?? DEFAULT_DURATION_MS;
  if (type === "fixed") {
    return scheduleTask(
      plan,
      {
        id,
        taskId: payload.taskId,
        type: "fixed",
        startMs: slot.startMs,
        endMs: slot.startMs + durationMs,
      },
      { confirmed: false },
    );
  }
  return scheduleTask(
    plan,
    {
      id,
      taskId: payload.taskId,
      type: "flexible",
      durationMs,
      precedingAnchorId: slot.precedingAnchorId,
      chainPosition: slot.chainPosition,
    },
    { confirmed: false },
  );
}

export function payloadFromDropData(
  raw: string | null | undefined,
): TaskDragPayload | null {
  return parseTaskDrag(raw);
}

export function previewMoveBlock(
  plan: DayPlan,
  blockId: string,
  startMs: number,
): MutationPreview {
  const block = plan.blocks.find((item) => item.id === blockId);
  if (!block) {
    throw new Error(`Unknown block ${blockId}`);
  }
  if (block.type === "fixed") {
    return dragFixedBody(plan, blockId, startMs, { confirmed: false });
  }
  const place = flexiblePlacementAt(plan, startMs, blockId);
  return dragFlexibleBody(plan, blockId, place, { confirmed: false });
}

export function previewResize(
  plan: DayPlan,
  blockId: string,
  durationMs: number,
): MutationPreview {
  return dragEdge(plan, blockId, { durationMs }, { confirmed: false });
}

export function previewUnschedule(
  plan: DayPlan,
  blockId: string,
): MutationPreview {
  return unschedule(plan, blockId, { confirmed: false });
}

export function previewConvert(
  plan: DayPlan,
  blockId: string,
  to: "fixed" | "flexible",
): MutationPreview {
  return convertType(plan, blockId, to, { confirmed: false });
}

export function previewReorder(
  plan: DayPlan,
  blockId: string,
  delta: number,
): MutationPreview {
  const block = plan.blocks.find((item) => item.id === blockId);
  if (!block || !isFlexibleBlock(block)) {
    throw new Error("Reorder applies to flexible blocks [D28]");
  }
  return dragFlexibleBody(
    plan,
    blockId,
    {
      precedingAnchorId: block.precedingAnchorId,
      chainPosition: Math.max(0, block.chainPosition + delta),
    },
    { confirmed: false },
  );
}

export function previewMoveToChain(
  plan: DayPlan,
  blockId: string,
  precedingAnchorId: ChainId,
): MutationPreview {
  const block = plan.blocks.find((item) => item.id === blockId);
  if (!block || !isFlexibleBlock(block)) {
    throw new Error("Chain move applies to flexible blocks [D28]");
  }
  return dragFlexibleBody(
    plan,
    blockId,
    { precedingAnchorId, chainPosition: 0 },
    { confirmed: false },
  );
}

export function chainTargets(plan: DayPlan): { id: string; label: string }[] {
  return [
    { id: "", label: COPY.chainFromStart },
    ...plan.blocks.filter(isFixedBlock).map((block) => ({
      id: block.id,
      label: isReserveBlock(block) ? COPY.reserve : block.taskId,
    })),
  ];
}

export function chainLabel(chain: ChainId): string {
  if (chain === null) {
    return COPY.chainFromStart;
  }
  return `Chain after ${chain}`;
}

export function blockTitle(
  block: CalendarBlock,
  titles: ReadonlyMap<string, string>,
): string {
  if (isReserveBlock(block)) {
    return COPY.reserve;
  }
  return titles.get(block.taskId) ?? block.taskId;
}

export function previewRows(
  original: DayPlan,
  preview: MutationPreview,
  titles: ReadonlyMap<string, string> = new Map(),
): { id: string; title: string; span: string; conflict: boolean }[] {
  const before = packDay(original);
  const after = packDay(preview.next);
  const beforeTimes = new Map(
    before.blocks.map((block) => [
      block.id,
      `${block.derivedStartMs}:${block.derivedEndMs}`,
    ]),
  );
  const afterIds = new Set(after.blocks.map((block) => block.id));
  const rows: { id: string; title: string; span: string; conflict: boolean }[] =
    [];

  function titleOf(block: CalendarBlock): string {
    if (isReserveBlock(block)) {
      return COPY.reserve;
    }
    return titles.get(block.taskId) ?? block.taskId;
  }

  for (const block of after.blocks) {
    const signature = `${block.derivedStartMs}:${block.derivedEndMs}`;
    const previous = beforeTimes.get(block.id);
    if (previous === signature) {
      const originalBlock = original.blocks.find(
        (item) => item.id === block.id,
      );
      const nextBlock = preview.next.blocks.find(
        (item) => item.id === block.id,
      );
      if (
        originalBlock &&
        nextBlock &&
        originalBlock.type === nextBlock.type &&
        originalBlock.conflict === nextBlock.conflict
      ) {
        continue;
      }
    }
    rows.push({
      id: block.id,
      title: titleOf(block),
      span: formatSpan(block.derivedStartMs, block.derivedEndMs),
      conflict: block.conflict,
    });
  }
  for (const block of before.blocks) {
    if (!afterIds.has(block.id)) {
      rows.push({
        id: block.id,
        title: titleOf(block),
        span: COPY.unscheduled,
        conflict: false,
      });
    }
  }
  return rows;
}

export function packedTimes(packed: PackedDay): Map<string, string> {
  return new Map(
    packed.blocks.map((block) => [
      block.id,
      `${block.derivedStartMs}:${block.derivedEndMs}`,
    ]),
  );
}

export { resolveConflict };
