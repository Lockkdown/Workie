import { projectDisplayedOutcome } from "./statusHistory";
import type {
  Occurrence,
  StatusHistoryEvent,
  Task,
  TaskSource,
  TaskStatus,
} from "./types";

export type BlockSignal = {
  id: string;
  startsAt: number;
};

export type CardSignals = {
  title: string;
  status: TaskStatus;
  displayedOutcome: { currentStatus: TaskStatus };
  source: TaskSource;
  nearestBlock: BlockSignal | "Unscheduled";
  extraBlockCount: number;
  extraBlocksCaption: string | undefined;
  subtaskProgress: { done: number; total: number } | undefined;
  repeat:
    | {
        mark: true;
        occurrenceDate?: string;
      }
    | undefined;
};

function nearestBlock(
  owned: readonly BlockSignal[],
  now: number,
): BlockSignal | "Unscheduled" {
  if (owned.length === 0) {
    return "Unscheduled";
  }
  const upcoming = owned
    .filter((block) => block.startsAt >= now)
    .sort((a, b) => a.startsAt - b.startsAt);
  const next = upcoming[0];
  if (next) {
    return next;
  }
  const past = [...owned].sort((a, b) => b.startsAt - a.startsAt);
  return past[0] ?? "Unscheduled";
}

/**
 * Headless projector for card always-on signals [D8] [D12] [D16].
 * One status even when several blocks exist.
 */
export function cardSignals(input: {
  task: Task;
  occurrence?: Occurrence;
  blocks: readonly BlockSignal[];
  now: number;
  history?: readonly StatusHistoryEvent[];
}): CardSignals {
  const entity = input.occurrence ?? input.task;
  const owned = input.blocks.filter((block) =>
    entity.blockIds.includes(block.id),
  );
  const extraBlockCount = owned.length > 1 ? owned.length - 1 : 0;
  const done = input.task.subtasks.filter((item) => item.done).length;
  const total = input.task.subtasks.length;
  const repeating =
    input.task.repeatWeekdays !== undefined || input.occurrence !== undefined;

  return {
    title: input.task.title,
    status: entity.status,
    displayedOutcome: projectDisplayedOutcome(
      entity.status,
      input.history ?? [],
    ),
    source: input.task.source,
    nearestBlock: nearestBlock(owned, input.now),
    extraBlockCount,
    extraBlocksCaption:
      extraBlockCount > 0 ? `+${extraBlockCount} blocks` : undefined,
    subtaskProgress: total > 0 ? { done, total } : undefined,
    repeat: repeating
      ? {
          mark: true,
          occurrenceDate: input.occurrence?.date,
        }
      : undefined,
  };
}
