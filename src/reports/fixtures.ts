import type { PomodoroCycle } from "../pomodoro/types";
import type { StatusHistoryEvent } from "../domain/types";

export function endedCycle(input: {
  id: string;
  taskId: string;
  startMs: number;
  endMs: number;
  outcome: "Timer complete" | "Stopped early" | "Discarded";
  workieDay: string;
  blockId?: string | null;
  second?: { taskId: string; startMs: number; endMs: number };
}): PomodoroCycle {
  const sessions = [
    {
      id: `${input.id}-s1`,
      cycleId: input.id,
      taskId: input.taskId,
      blockId: input.blockId === undefined ? null : input.blockId,
      startedAt: input.startMs,
      endedAt: input.second?.startMs ?? input.endMs,
      closeReason: input.second
        ? ("Switched task" as const)
        : ("Cycle ended" as const),
      workieDay: input.workieDay,
      segments: [
        {
          id: `${input.id}-g1`,
          sessionId: `${input.id}-s1`,
          startedAt: input.startMs,
          endedAt: input.second?.startMs ?? input.endMs,
        },
      ],
    },
  ];
  if (input.second) {
    sessions.push({
      id: `${input.id}-s2`,
      cycleId: input.id,
      taskId: input.second.taskId,
      blockId: null,
      startedAt: input.second.startMs,
      endedAt: input.second.endMs,
      closeReason: "Cycle ended",
      workieDay: input.workieDay,
      segments: [
        {
          id: `${input.id}-g2`,
          sessionId: `${input.id}-s2`,
          startedAt: input.second.startMs,
          endedAt: input.second.endMs,
        },
      ],
    });
  }
  return {
    id: input.id,
    workieDay: input.workieDay,
    budgetMs: 30 * 60_000,
    state: "ended",
    outcome: input.outcome,
    startedAt: input.startMs,
    lastCertainAt: input.endMs,
    currentSessionId: null,
    sessions,
    createdAt: input.startMs,
    updatedAt: input.endMs,
  };
}

export function statusEvent(input: {
  id: string;
  entityId: string;
  status: StatusHistoryEvent["status"];
  workieDay: string;
  at: number;
  entityKind?: StatusHistoryEvent["entityKind"];
}): StatusHistoryEvent {
  return {
    id: input.id,
    entityId: input.entityId,
    entityKind: input.entityKind ?? "task",
    status: input.status,
    workieDay: input.workieDay,
    at: input.at,
    createdAt: input.at,
    updatedAt: input.at,
  };
}
