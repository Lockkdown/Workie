import { recordStatusEvent } from "./statusHistory";
import type {
  LiveStatus,
  StatusEntity,
  StatusHistoryEvent,
  TaskStatus,
} from "./types";
import { isClosedStatus, isLiveStatus } from "./types";

export type TransitionResult<E extends StatusEntity> = {
  entity: E;
  history: StatusHistoryEvent[];
};

function cloneEntity<E extends StatusEntity>(
  entity: E,
  status: TaskStatus,
  now: number,
): E {
  const next: StatusEntity = {
    ...entity,
    status,
    updatedAt: now,
    blockIds: [...entity.blockIds],
    focusHistory: [...entity.focusHistory],
  };
  if (next.kind === "task") {
    next.subtasks = next.subtasks.map((item) => ({ ...item }));
    next.source = { ...next.source };
    if (next.repeatWeekdays) {
      next.repeatWeekdays = [...next.repeatWeekdays];
    }
  }
  return next as E;
}

function applyStatus<E extends StatusEntity>(
  entity: E,
  next: TaskStatus,
  now: number,
  history: readonly StatusHistoryEvent[],
): TransitionResult<E> {
  return {
    entity: cloneEntity(entity, next, now),
    history: recordStatusEvent(history, {
      entityId: entity.id,
      entityKind: entity.kind,
      status: next,
      now,
    }),
  };
}

function assertLive(entity: StatusEntity, action: string): void {
  if (!isLiveStatus(entity.status)) {
    throw new Error(`${action} is only available from a live status [D14]`);
  }
}

/**
 * Drag-between-live-columns API. Reorder must not use this [D14].
 * Never reaches Completed / Abandoned / Cancelled.
 */
export function moveLiveStatus<E extends StatusEntity>(
  entity: E,
  to: LiveStatus,
  now: number,
  history: readonly StatusHistoryEvent[],
): TransitionResult<E> {
  assertLive(entity, "moveLiveStatus");
  if (!isLiveStatus(to)) {
    throw new Error("Final outcomes are never reachable by drag [D14]");
  }
  return applyStatus(entity, to, now, history);
}

/** Explicit complete action only. Never from drag or a timer [D4] [D14]. */
export function complete<E extends StatusEntity>(
  entity: E,
  now: number,
  history: readonly StatusHistoryEvent[],
): TransitionResult<E> {
  assertLive(entity, "complete");
  return applyStatus(entity, "Completed", now, history);
}

function assertConfirmed(confirmation: { confirmed?: boolean }): void {
  if (confirmation.confirmed !== true) {
    throw new Error("Abandoned and Cancelled require confirmation [D14]");
  }
}

export function abandon<E extends StatusEntity>(
  entity: E,
  confirmation: { confirmed: true },
  now: number,
  history: readonly StatusHistoryEvent[],
): TransitionResult<E> {
  assertConfirmed(confirmation);
  assertLive(entity, "abandon");
  return applyStatus(entity, "Abandoned", now, history);
}

export function cancel<E extends StatusEntity>(
  entity: E,
  confirmation: { confirmed: true },
  now: number,
  history: readonly StatusHistoryEvent[],
): TransitionResult<E> {
  assertConfirmed(confirmation);
  assertLive(entity, "cancel");
  return applyStatus(entity, "Cancelled", now, history);
}

/**
 * Restore → Waiting. Preserves focus history. Never rewrites recorded
 * status-history events [D14] [D50].
 */
export function restore<E extends StatusEntity>(
  entity: E,
  now: number,
  history: readonly StatusHistoryEvent[],
): TransitionResult<E> {
  if (!isClosedStatus(entity.status)) {
    throw new Error("Restore is only available from a closed status [D14]");
  }
  return applyStatus(entity, "Waiting", now, history);
}

/** Reorder inside a live column. Does not change status [D14]. */
export function reorderLive<E extends StatusEntity>(
  entity: E,
  liveOrder: number,
  now: number,
): E {
  if (!isLiveStatus(entity.status)) {
    throw new Error("Closed tasks cannot be hand-sorted [D14]");
  }
  return cloneEntity({ ...entity, liveOrder } as E, entity.status, now);
}
