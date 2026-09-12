import {
  type CalendarBlock,
  type DayPlan,
  createDayPlan,
  isTaskBlock,
} from "../calendar/index";
import type { PersistedBlock, WorkieDB } from "../db/schema";
import { persistTaskGraph, loadTaskState } from "../db/taskPersistence";
import { setBlockIds } from "../domain/taskModel";
import { dayPlanSettingId } from "./constants";

export type DayPlanExtras = {
  runningBlockId: string | null;
  chainStartDelayMs: Record<string, number>;
};

function isCalendarBlockRecord(value: unknown): value is PersistedBlock {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Partial<PersistedBlock>;
  const kindOk = rec.kind === "task" || rec.kind === "reserve";
  const typeOk = rec.type === "fixed" || rec.type === "flexible";
  const taskOk = rec.kind !== "task" || typeof rec.taskId === "string";
  return (
    kindOk &&
    typeOk &&
    taskOk &&
    typeof rec.id === "string" &&
    typeof rec.day === "string" &&
    typeof rec.durationMs === "number"
  );
}

function extrasFromJson(raw: string | undefined): DayPlanExtras {
  const fallback: DayPlanExtras = {
    runningBlockId: null,
    chainStartDelayMs: {},
  };
  if (raw === undefined || raw.length === 0) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return fallback;
    }
    const rec = parsed as Partial<DayPlanExtras>;
    const runningBlockId =
      rec.runningBlockId === null || typeof rec.runningBlockId === "string"
        ? rec.runningBlockId
        : null;
    const chainStartDelayMs =
      rec.chainStartDelayMs && typeof rec.chainStartDelayMs === "object"
        ? rec.chainStartDelayMs
        : {};
    return { runningBlockId: runningBlockId ?? null, chainStartDelayMs };
  } catch {
    return fallback;
  }
}

export function toCalendarBlock(record: PersistedBlock): CalendarBlock {
  if (record.kind === "task" && record.type === "fixed") {
    return {
      id: record.id,
      kind: "task",
      taskId: record.taskId ?? "",
      type: "fixed",
      day: record.day,
      startMs: record.startMs,
      endMs: record.endMs,
      durationMs: record.durationMs,
      conflict: record.conflict,
      keptConflict: record.keptConflict,
    };
  }
  if (record.kind === "task" && record.type === "flexible") {
    return {
      id: record.id,
      kind: "task",
      taskId: record.taskId ?? "",
      type: "flexible",
      day: record.day,
      durationMs: record.durationMs,
      chainPosition: record.chainPosition,
      precedingAnchorId: record.precedingAnchorId,
      conflict: record.conflict,
      keptConflict: record.keptConflict,
    };
  }
  if (record.kind === "reserve" && record.type === "fixed") {
    return {
      id: record.id,
      kind: "reserve",
      type: "fixed",
      day: record.day,
      startMs: record.startMs,
      endMs: record.endMs,
      durationMs: record.durationMs,
      conflict: record.conflict,
      keptConflict: record.keptConflict,
    };
  }
  return {
    id: record.id,
    kind: "reserve",
    type: "flexible",
    day: record.day,
    durationMs: record.durationMs,
    chainPosition: record.chainPosition,
    precedingAnchorId: record.precedingAnchorId,
    conflict: record.conflict,
    keptConflict: record.keptConflict,
  };
}

export function toPersistedBlock(
  block: CalendarBlock,
  now: number,
  previous?: { createdAt: number },
): PersistedBlock {
  if (block.kind === "task") {
    return {
      ...block,
      taskId: block.taskId,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
  }
  return {
    ...block,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function loadDayPlan(db: WorkieDB, day: string): Promise<DayPlan> {
  const records = await db.blocks.where("day").equals(day).toArray();
  const extrasRow = await db.settings.get(dayPlanSettingId(day));
  const extras = extrasFromJson(extrasRow?.value);
  const blocks = records.filter(isCalendarBlockRecord).map(toCalendarBlock);
  return createDayPlan(day, blocks, extras);
}

export async function persistDayPlan(
  db: WorkieDB,
  previous: DayPlan,
  next: DayPlan,
  now: number,
): Promise<void> {
  const existing = await db.blocks.where("day").equals(next.day).toArray();
  const existingById = new Map(existing.map((record) => [record.id, record]));
  const nextIds = new Set(next.blocks.map((block) => block.id));
  const toDelete = existing
    .map((record) => record.id)
    .filter((id) => !nextIds.has(id));
  const records = next.blocks.map((block) =>
    toPersistedBlock(block, now, existingById.get(block.id)),
  );
  const extrasId = dayPlanSettingId(next.day);
  const existingExtras = await db.settings.get(extrasId);
  const extrasValue = JSON.stringify({
    runningBlockId: next.runningBlockId,
    chainStartDelayMs: next.chainStartDelayMs,
  } satisfies DayPlanExtras);

  await db.transaction("rw", db.blocks, db.settings, async () => {
    if (records.length > 0) {
      await db.blocks.bulkPut(records);
    }
    if (toDelete.length > 0) {
      await db.blocks.bulkDelete(toDelete);
    }
    await db.settings.put({
      id: extrasId,
      value: extrasValue,
      createdAt: existingExtras?.createdAt ?? now,
      updatedAt: now,
    });
  });

  await syncBlockIds(db, previous, next, now);
}

async function syncBlockIds(
  db: WorkieDB,
  previous: DayPlan,
  next: DayPlan,
  now: number,
): Promise<void> {
  const state = await loadTaskState(db);
  const oldIds = new Set(
    previous.blocks.filter(isTaskBlock).map((block) => block.id),
  );
  const nextByEntity = new Map<string, string[]>();
  for (const block of next.blocks) {
    if (!isTaskBlock(block)) {
      continue;
    }
    const list = nextByEntity.get(block.taskId) ?? [];
    list.push(block.id);
    nextByEntity.set(block.taskId, list);
  }

  const tasks = state.tasks.flatMap((task) => {
    const kept = task.blockIds.filter((id) => !oldIds.has(id));
    const added = nextByEntity.get(task.id) ?? [];
    const merged = [...kept];
    for (const id of added) {
      if (!merged.includes(id)) {
        merged.push(id);
      }
    }
    if (
      merged.length === task.blockIds.length &&
      merged.every((id, i) => id === task.blockIds[i])
    ) {
      return [];
    }
    return [setBlockIds(task, merged, now)];
  });

  const occurrences = state.occurrences.flatMap((occurrence) => {
    const kept = occurrence.blockIds.filter((id) => !oldIds.has(id));
    const added = nextByEntity.get(occurrence.id) ?? [];
    const merged = [...kept];
    for (const id of added) {
      if (!merged.includes(id)) {
        merged.push(id);
      }
    }
    if (
      merged.length === occurrence.blockIds.length &&
      merged.every((id, i) => id === occurrence.blockIds[i])
    ) {
      return [];
    }
    return [setBlockIds(occurrence, merged, now)];
  });

  if (tasks.length === 0 && occurrences.length === 0) {
    return;
  }
  await persistTaskGraph(db, { tasks, occurrences });
}
