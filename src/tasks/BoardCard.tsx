import type { DragEvent, JSX } from "react";
import type { CardSignals } from "../domain/cardSignals";
import type { LiveStatus } from "../domain/types";
import { isLiveStatus } from "../domain/types";
import { Button } from "../ui/Button";
import { TaskCard } from "../ui/TaskCard";
import { writeBoardCardDrag } from "./boardDrag";
import type { BoardItem } from "./boardModel";
import { formatNearestBlock, scheduleTaskId, sourceLabel } from "./boardModel";
import { COPY } from "./copy";
import { statusUnchangedMessage } from "./boardActions";

export type BoardCardHandlers = {
  onScheduleTask: (taskId: string) => void;
  onComplete: (entityId: string) => void;
  onRestore: (entityId: string) => void;
  onRequestAbandon: (entityId: string) => void;
  onRequestCancel: (entityId: string) => void;
  onConfirmClose: () => void;
  onDismissConfirm: () => void;
  onMoveUp: (entityId: string) => void;
  onMoveDown: (entityId: string) => void;
  onMoveTo: (entityId: string, status: LiveStatus) => void;
  onOpenDetail: (entityId: string) => void;
  onRetry: (entityId: string) => void;
  onDropOnColumn: (
    status: LiveStatus,
    index: number,
    event: DragEvent<HTMLElement>,
  ) => void;
};

export type BoardCardProps = {
  item: BoardItem;
  signals: CardSignals;
  index: number;
  confirming: { entityId: string; action: "abandon" | "cancel" } | null;
  partialCause?: string;
  handlers: BoardCardHandlers;
};

const LIVE_MOVE: { status: LiveStatus; label: string }[] = [
  { status: "Waiting", label: COPY.moveToWaiting },
  { status: "In Progress", label: COPY.moveToInProgress },
  { status: "Deferred", label: COPY.moveToDeferred },
];

export function BoardCard({
  item,
  signals,
  index,
  confirming,
  partialCause,
  handlers,
}: BoardCardProps): JSX.Element {
  const live = isLiveStatus(item.entity.status);
  const entityId = item.entity.id;
  const taskId = scheduleTaskId(item);
  const isConfirming = confirming?.entityId === entityId;

  function handleDragStart(event: DragEvent<HTMLLIElement>): void {
    if (!live || event.dataTransfer === null) {
      return;
    }
    writeBoardCardDrag(event.dataTransfer, {
      entityId,
      kind: item.entity.kind,
      taskId,
    });
  }

  function handleDrop(event: DragEvent<HTMLLIElement>): void {
    if (!isLiveStatus(item.entity.status)) {
      return;
    }
    handlers.onDropOnColumn(item.entity.status, index, event);
  }

  return (
    <li
      className="task-board-card"
      data-entity-id={entityId}
      data-entity-kind={item.entity.kind}
      data-ornament="dense"
      data-partial-failure={partialCause ? "true" : "false"}
      draggable={live}
      onDragStart={handleDragStart}
      onDragOver={
        live
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      onDrop={live ? handleDrop : undefined}
    >
      <TaskCard
        status={item.entity.status}
        title={signals.title}
        ornament="dense"
      />
      <div className="task-board-signals type-body-s">
        <span data-signal="source">
          {COPY.sourceCreator}: {sourceLabel(signals.source)}
        </span>
        <span data-signal="schedule">
          {formatNearestBlock(signals.nearestBlock)}
        </span>
        {signals.extraBlocksCaption ? (
          <span data-signal="extra-blocks">{signals.extraBlocksCaption}</span>
        ) : null}
        {signals.subtaskProgress ? (
          <span data-signal="subtasks">
            {signals.subtaskProgress.done}/{signals.subtaskProgress.total}
          </span>
        ) : null}
        {signals.repeat ? (
          <span data-signal="repeat">
            {COPY.repeat}
            {signals.repeat.occurrenceDate
              ? ` ${signals.repeat.occurrenceDate}`
              : ""}
          </span>
        ) : null}
      </div>
      {partialCause ? (
        <div className="task-board-partial" data-error="partial">
          <p className="type-body-s">{statusUnchangedMessage(partialCause)}</p>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            ornament="dense"
            onClick={() => handlers.onRetry(entityId)}
          >
            {COPY.retry}
          </Button>
        </div>
      ) : null}
      {isConfirming && confirming ? (
        <div className="task-board-confirm" role="dialog">
          <p className="type-body-m">
            {confirming.action === "abandon"
              ? COPY.abandonConfirm
              : COPY.cancelConfirm}
          </p>
          <div className="task-board-card-actions">
            <Button
              type="button"
              variant="primary"
              size="compact"
              ornament="dense"
              onClick={handlers.onConfirmClose}
            >
              {confirming.action === "abandon"
                ? COPY.confirmAbandon
                : COPY.confirmCancel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              ornament="dense"
              onClick={handlers.onDismissConfirm}
            >
              {COPY.goBack}
            </Button>
          </div>
        </div>
      ) : (
        <div className="task-board-card-actions">
          {live ? (
            <>
              <label className="type-body-s">
                <input
                  type="checkbox"
                  aria-label={COPY.complete}
                  checked={false}
                  onChange={() => handlers.onComplete(entityId)}
                />{" "}
                {COPY.complete}
              </label>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                ornament="dense"
                onClick={() => handlers.onComplete(entityId)}
              >
                {COPY.complete}
              </Button>
              <details>
                <summary className="type-body-s">{COPY.moreActions}</summary>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  ornament="dense"
                  onClick={() => handlers.onRequestAbandon(entityId)}
                >
                  {COPY.abandon}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  ornament="dense"
                  onClick={() => handlers.onRequestCancel(entityId)}
                >
                  {COPY.cancel}
                </Button>
              </details>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                ornament="dense"
                onClick={() => handlers.onScheduleTask(taskId)}
              >
                {COPY.addToDayPlan}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                ornament="dense"
                onClick={() => handlers.onMoveUp(entityId)}
              >
                {COPY.moveUp}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                ornament="dense"
                onClick={() => handlers.onMoveDown(entityId)}
              >
                {COPY.moveDown}
              </Button>
              {LIVE_MOVE.filter(
                (entry) => entry.status !== item.entity.status,
              ).map((entry) => (
                <Button
                  key={entry.status}
                  type="button"
                  variant="secondary"
                  size="compact"
                  ornament="dense"
                  onClick={() => handlers.onMoveTo(entityId, entry.status)}
                >
                  {entry.label}
                </Button>
              ))}
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="compact"
              ornament="dense"
              onClick={() => handlers.onRestore(entityId)}
            >
              {COPY.restore}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="compact"
            ornament="dense"
            onClick={() => handlers.onOpenDetail(entityId)}
          >
            {COPY.openTask}
          </Button>
        </div>
      )}
    </li>
  );
}
