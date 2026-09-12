import type { DragEvent, JSX } from "react";
import type { BlockSignal } from "../domain/cardSignals";
import type {
  LiveStatus,
  Occurrence,
  StatusHistoryEvent,
  Task,
} from "../domain/types";
import { KANBAN_COLUMNS } from "../domain/types";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { BoardCard, type BoardCardHandlers } from "./BoardCard";
import { COPY } from "./copy";
import {
  findItem,
  groupBoard,
  selectBoardItems,
  signalsFor,
} from "./boardModel";
import { TaskDetail } from "./TaskDetail";
import { TaskForm } from "./TaskForm";
import { readBoardCardDrag } from "./boardDrag";

export type PartialFailure = {
  cause: string;
};

export type TaskBoardViewProps = {
  tasks: readonly Task[];
  occurrences: readonly Occurrence[];
  statusHistory: readonly StatusHistoryEvent[];
  blocks: readonly BlockSignal[];
  now: number;
  online: boolean;
  loading: boolean;
  formOpen: boolean;
  detailEntityId: string | null;
  confirming: { entityId: string; action: "abandon" | "cancel" } | null;
  partialFailures: Readonly<Record<string, PartialFailure>>;
  onClose: () => void;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onCloseDetail: () => void;
  onCreated: (result: { task: Task; history: StatusHistoryEvent[] }) => void;
  handlers: BoardCardHandlers;
};

export function noopBoardHandlers(): BoardCardHandlers {
  return {
    onScheduleTask: () => undefined,
    onComplete: () => undefined,
    onRestore: () => undefined,
    onRequestAbandon: () => undefined,
    onRequestCancel: () => undefined,
    onConfirmClose: () => undefined,
    onDismissConfirm: () => undefined,
    onMoveUp: () => undefined,
    onMoveDown: () => undefined,
    onMoveTo: () => undefined,
    onOpenDetail: () => undefined,
    onRetry: () => undefined,
    onDropOnColumn: () => undefined,
  };
}

function OfflineBanner({ online }: { online: boolean }): JSX.Element | null {
  if (online) {
    return null;
  }
  return (
    <div className="task-board-offline" role="status" data-offline="true">
      <svg
        className="task-board-offline-icon"
        viewBox="0 0 16 16"
        width={16}
        height={16}
        data-icon="offline"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2 8h12M5 5 2 8l3 3M11 5l3 3-3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span className="type-body-s">{COPY.offline}</span>
      <span className="type-body-s">{COPY.saveStateOffline}</span>
    </div>
  );
}

function LoadingSkeleton(): JSX.Element {
  return (
    <div
      className="task-board-columns"
      data-state="loading"
      aria-busy="true"
      aria-label={COPY.loading}
    >
      {KANBAN_COLUMNS.map((column) => (
        <section
          key={column}
          className="task-board-column ui-ornament"
          data-ornament="panel"
          data-column={column}
        >
          <div className="ui-ornament-content">
            <h3 className="task-board-column-title type-display-m">{column}</h3>
            {column === "Closed" ? (
              <>
                <h4 className="task-board-subgroup-title type-display-m">
                  Completed
                </h4>
                <div className="task-board-skeleton-card" />
                <h4 className="task-board-subgroup-title type-display-m">
                  Abandoned
                </h4>
                <div className="task-board-skeleton-card" />
                <h4 className="task-board-subgroup-title type-display-m">
                  Cancelled
                </h4>
                <div className="task-board-skeleton-card" />
              </>
            ) : (
              <div className="task-board-skeleton-card" />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function TaskBoardView({
  tasks,
  occurrences,
  statusHistory,
  blocks,
  now,
  online,
  loading,
  formOpen,
  detailEntityId,
  confirming,
  partialFailures,
  onClose,
  onOpenForm,
  onCloseForm,
  onCloseDetail,
  onCreated,
  handlers,
}: TaskBoardViewProps): JSX.Element {
  const items = selectBoardItems(tasks, occurrences, now);
  const columns = groupBoard(items, statusHistory);
  const empty = !loading && items.length === 0;
  const detailItem =
    detailEntityId === null ? undefined : findItem(items, detailEntityId);
  const showPrimary = !formOpen && confirming === null;

  function handleColumnDrop(
    status: LiveStatus,
    index: number,
    event: DragEvent<HTMLElement>,
  ): void {
    handlers.onDropOnColumn(status, index, event);
  }

  return (
    <Panel title={COPY.boardTitle} ornament="panel" role="dialog">
      <div className="task-board">
        <OfflineBanner online={online} />
        <div className="task-board-toolbar">
          {showPrimary ? (
            <Button
              type="button"
              variant="primary"
              size="primary"
              ornament="dense"
              onClick={onOpenForm}
            >
              {COPY.createTask}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="primary"
            ornament="dense"
            onClick={onClose}
          >
            {COPY.close}
          </Button>
        </div>
        {formOpen ? (
          <TaskForm open={true} onClose={onCloseForm} onCreated={onCreated} />
        ) : null}
        {empty ? (
          <div className="task-board-empty" data-state="empty">
            <span className="task-board-motif" aria-hidden="true" />
            <p className="type-body-m">{COPY.emptyStep}</p>
          </div>
        ) : null}
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="task-board-columns" data-state="ready">
            {KANBAN_COLUMNS.map((column) => {
              const liveColumn =
                column === "Closed" ? undefined : columns[column];
              return (
                <section
                  key={column}
                  className="task-board-column ui-ornament"
                  data-ornament="panel"
                  data-column={column}
                  onDragOver={
                    column === "Closed"
                      ? undefined
                      : (event) => {
                          event.preventDefault();
                        }
                  }
                  onDrop={
                    column === "Closed"
                      ? (event) => {
                          event.preventDefault();
                          void readBoardCardDrag(event.dataTransfer);
                        }
                      : (event) => {
                          event.preventDefault();
                          handleColumnDrop(
                            column,
                            liveColumn?.length ?? 0,
                            event,
                          );
                        }
                  }
                >
                  <div className="ui-ornament-content">
                    <h3 className="task-board-column-title type-display-m">
                      {column}
                    </h3>
                    {column === "Closed" ? (
                      columns.Closed.map((group) => (
                        <div
                          key={group.status}
                          className="task-board-subgroup"
                          data-subgroup={group.status}
                        >
                          <h4 className="task-board-subgroup-title type-display-m">
                            {group.status}
                          </h4>
                          <ul className="task-board-card-list">
                            {group.items.map((item, index) => (
                              <BoardCard
                                key={item.entity.id}
                                item={item}
                                signals={signalsFor(
                                  item,
                                  blocks,
                                  now,
                                  statusHistory,
                                )}
                                index={index}
                                confirming={confirming}
                                partialCause={
                                  partialFailures[item.entity.id]?.cause
                                }
                                handlers={handlers}
                              />
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <ul className="task-board-card-list">
                        {(liveColumn ?? []).map((item, index) => (
                          <BoardCard
                            key={item.entity.id}
                            item={item}
                            signals={signalsFor(
                              item,
                              blocks,
                              now,
                              statusHistory,
                            )}
                            index={index}
                            confirming={confirming}
                            partialCause={
                              partialFailures[item.entity.id]?.cause
                            }
                            handlers={handlers}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {detailItem ? (
          <TaskDetail
            item={detailItem}
            signals={signalsFor(detailItem, blocks, now, statusHistory)}
            blocks={blocks}
            history={statusHistory}
            onClose={onCloseDetail}
          />
        ) : null}
      </div>
    </Panel>
  );
}
