/**
 * T5 Task Board. Daily Desk (T7) must mount this from the Tasks tray [D81].
 * Tray control copy: "Open Task Board".
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type JSX,
} from "react";
import type { TaskBoardProps } from "../desk/boardContract";
import type { BlockSignal } from "../domain/cardSignals";
import type {
  LiveStatus,
  Occurrence,
  StatusEntity,
  StatusHistoryEvent,
  Task,
} from "../domain/types";
import { loadTaskState } from "../db/taskPersistence";
import { appDb } from "../shell/appDb";
import {
  persistAbandonEntity,
  persistBoardItems,
  persistCancelEntity,
  persistCompleteEntity,
  persistRestoreEntity,
} from "./boardActions";
import { readBoardCardDrag } from "./boardDrag";
import { blockSignalsFromRecords } from "./blockSignals";
import {
  applyLiveDrop,
  applyMoveRelative,
  applyMoveToLive,
  findItem,
  selectBoardItems,
  type BoardItem,
} from "./boardModel";
import type { BoardCardHandlers } from "./BoardCard";
import { TaskBoardView, type PartialFailure } from "./TaskBoardView";
import { TaskForm } from "./TaskForm";
import "./taskBoard.css";

export { TaskForm };
export type { TaskFormProps } from "./TaskForm";

type SessionState = {
  tasks: Task[];
  occurrences: Occurrence[];
  statusHistory: StatusHistoryEvent[];
  blocks: BlockSignal[];
};

type FailedOp =
  | { kind: "complete"; entityId: string }
  | { kind: "abandon"; entityId: string }
  | { kind: "cancel"; entityId: string }
  | { kind: "restore"; entityId: string }
  | { kind: "move"; entityId: string; to: LiveStatus }
  | { kind: "reorder"; entityId: string; direction: -1 | 1 }
  | {
      kind: "drop";
      entityId: string;
      to: LiveStatus;
      toIndex: number;
    };

function itemsToState(
  previous: SessionState,
  items: readonly BoardItem[],
  history: readonly StatusHistoryEvent[],
): SessionState {
  const tasks = new Map(previous.tasks.map((task) => [task.id, task]));
  const occurrences = new Map(
    previous.occurrences.map((occurrence) => [occurrence.id, occurrence]),
  );
  for (const item of items) {
    if (item.entity.kind === "task") {
      tasks.set(item.entity.id, item.entity);
    } else {
      occurrences.set(item.entity.id, item.entity);
    }
    if (item.task.kind === "task") {
      tasks.set(item.task.id, item.task);
    }
  }
  return {
    ...previous,
    tasks: [...tasks.values()],
    occurrences: [...occurrences.values()],
    statusHistory: [...history],
  };
}

function replaceEntity(
  state: SessionState,
  entity: StatusEntity,
): SessionState {
  if (entity.kind === "task") {
    return {
      ...state,
      tasks: state.tasks.map((task) => (task.id === entity.id ? entity : task)),
    };
  }
  return {
    ...state,
    occurrences: state.occurrences.map((occurrence) =>
      occurrence.id === entity.id ? entity : occurrence,
    ),
  };
}

function TaskBoardSession({
  onClose,
  onScheduleTask,
}: TaskBoardProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    entityId: string;
    action: "abandon" | "cancel";
  } | null>(null);
  const [partialFailures, setPartialFailures] = useState<
    Record<string, PartialFailure>
  >({});
  const [session, setSession] = useState<SessionState>({
    tasks: [],
    occurrences: [],
    statusHistory: [],
    blocks: [],
  });
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const failedRef = useRef<FailedOp | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadTaskState(appDb);
      const records = await appDb.blocks.toArray();
      setSession({
        tasks: loaded.tasks,
        occurrences: loaded.occurrences,
        statusHistory: loaded.statusHistory,
        blocks: blockSignalsFromRecords(records),
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setPartialFailures({
        board: { cause: message },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function sync(): void {
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const fail = useCallback((entityId: string, cause: unknown, op: FailedOp) => {
    failedRef.current = op;
    const message = cause instanceof Error ? cause.message : String(cause);
    setPartialFailures((current) => ({
      ...current,
      [entityId]: { cause: message },
    }));
  }, []);

  const clearFail = useCallback((entityId: string) => {
    setPartialFailures((current) => {
      if (!(entityId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[entityId];
      return next;
    });
  }, []);

  const runOp = useCallback(
    async (op: FailedOp): Promise<void> => {
      const now = Date.now();
      const current = sessionRef.current;
      const items = selectBoardItems(current.tasks, current.occurrences, now);
      const item = findItem(items, op.entityId);
      if (item === undefined && op.kind !== "drop") {
        return;
      }
      try {
        if (op.kind === "complete" && item) {
          const result = await persistCompleteEntity(
            appDb,
            item.entity,
            current.statusHistory,
            now,
          );
          setSession((prev) => ({
            ...replaceEntity(prev, result.entity),
            statusHistory: result.history,
          }));
        } else if (op.kind === "abandon" && item) {
          const result = await persistAbandonEntity(
            appDb,
            item.entity,
            current.statusHistory,
            now,
          );
          setSession((prev) => ({
            ...replaceEntity(prev, result.entity),
            statusHistory: result.history,
          }));
          setConfirming(null);
        } else if (op.kind === "cancel" && item) {
          const result = await persistCancelEntity(
            appDb,
            item.entity,
            current.statusHistory,
            now,
          );
          setSession((prev) => ({
            ...replaceEntity(prev, result.entity),
            statusHistory: result.history,
          }));
          setConfirming(null);
        } else if (op.kind === "restore" && item) {
          const result = await persistRestoreEntity(
            appDb,
            item.entity,
            current.statusHistory,
            now,
          );
          setSession((prev) => ({
            ...replaceEntity(prev, result.entity),
            statusHistory: result.history,
          }));
        } else if (op.kind === "move") {
          const moved = applyMoveToLive({
            items,
            history: current.statusHistory,
            entityId: op.entityId,
            to: op.to,
            now,
          });
          if ("intent" in moved) {
            return;
          }
          await persistBoardItems(appDb, items, moved.items, moved.history);
          setSession((prev) => itemsToState(prev, moved.items, moved.history));
        } else if (op.kind === "reorder") {
          const nextItems = applyMoveRelative({
            items,
            entityId: op.entityId,
            direction: op.direction,
            now,
          });
          if (nextItems === undefined) {
            return;
          }
          await persistBoardItems(appDb, items, nextItems);
          setSession((prev) =>
            itemsToState(prev, nextItems, prev.statusHistory),
          );
        } else if (op.kind === "drop") {
          const dropped = applyLiveDrop({
            items,
            history: current.statusHistory,
            entityId: op.entityId,
            toColumn: op.to,
            toIndex: op.toIndex,
            now,
          });
          if (dropped.intent === "ignored") {
            return;
          }
          await persistBoardItems(appDb, items, dropped.items, dropped.history);
          setSession((prev) =>
            itemsToState(prev, dropped.items, dropped.history),
          );
        }
        clearFail(op.entityId);
      } catch (cause) {
        fail(op.entityId, cause, op);
      }
    },
    [clearFail, fail],
  );

  const handlers: BoardCardHandlers = {
    onScheduleTask,
    onComplete: (entityId) => {
      void runOp({ kind: "complete", entityId });
    },
    onRestore: (entityId) => {
      void runOp({ kind: "restore", entityId });
    },
    onRequestAbandon: (entityId) => {
      setConfirming({ entityId, action: "abandon" });
    },
    onRequestCancel: (entityId) => {
      setConfirming({ entityId, action: "cancel" });
    },
    onConfirmClose: () => {
      if (confirming === null) {
        return;
      }
      void runOp({ kind: confirming.action, entityId: confirming.entityId });
    },
    onDismissConfirm: () => {
      setConfirming(null);
    },
    onMoveUp: (entityId) => {
      void runOp({ kind: "reorder", entityId, direction: -1 });
    },
    onMoveDown: (entityId) => {
      void runOp({ kind: "reorder", entityId, direction: 1 });
    },
    onMoveTo: (entityId, status) => {
      void runOp({ kind: "move", entityId, to: status });
    },
    onOpenDetail: (entityId) => {
      setDetailEntityId(entityId.length === 0 ? null : entityId);
    },
    onRetry: (entityId) => {
      const op = failedRef.current;
      if (op && op.entityId === entityId) {
        void runOp(op);
      }
    },
    onDropOnColumn: (
      status: LiveStatus,
      index: number,
      event: DragEvent<HTMLElement>,
    ) => {
      event.preventDefault();
      const payload = readBoardCardDrag(event.dataTransfer);
      if (payload === null) {
        return;
      }
      void runOp({
        kind: "drop",
        entityId: payload.entityId,
        to: status,
        toIndex: index,
      });
    },
  };

  return (
    <TaskBoardView
      tasks={session.tasks}
      occurrences={session.occurrences}
      statusHistory={session.statusHistory}
      blocks={session.blocks}
      now={Date.now()}
      online={online}
      loading={loading}
      formOpen={formOpen}
      detailEntityId={detailEntityId}
      confirming={confirming}
      partialFailures={partialFailures}
      onClose={onClose}
      onOpenForm={() => setFormOpen(true)}
      onCloseForm={() => setFormOpen(false)}
      onCloseDetail={() => setDetailEntityId(null)}
      onCreated={(result) => {
        setSession((prev) => ({
          ...prev,
          tasks: [...prev.tasks, result.task],
          statusHistory: [...prev.statusHistory, ...result.history],
        }));
        setFormOpen(false);
      }}
      handlers={handlers}
    />
  );
}

export function TaskBoard(props: TaskBoardProps): JSX.Element {
  if (!props.open) {
    return <></>;
  }
  return (
    <div className="task-board-layer">
      <TaskBoardSession {...props} />
    </div>
  );
}
