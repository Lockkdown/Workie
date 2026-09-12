import type { JSX } from "react";
import type { BlockSignal, CardSignals } from "../domain/cardSignals";
import type { StatusHistoryEvent } from "../domain/types";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { ProgressStatus } from "../ui/ProgressStatus";
import { StatusMark } from "../ui/StatusMark";
import type { BoardItem } from "./boardModel";
import { formatNearestBlock, weekdayNames } from "./boardModel";
import { COPY } from "./copy";

export type TaskDetailProps = {
  item: BoardItem;
  signals: CardSignals;
  blocks: readonly BlockSignal[];
  history: readonly StatusHistoryEvent[];
  onClose: () => void;
};

export function TaskDetail({
  item,
  signals,
  blocks,
  history,
  onClose,
}: TaskDetailProps): JSX.Element {
  const owned = blocks.filter((block) =>
    item.entity.blockIds.includes(block.id),
  );
  const entityHistory = history.filter(
    (event) => event.entityId === item.entity.id,
  );
  const done = signals.subtaskProgress?.done ?? 0;
  const total = signals.subtaskProgress?.total ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const source = item.task.source;

  return (
    <Panel title={item.task.title} ornament="panel" role="dialog">
      <div className="task-board-detail type-body-m">
        <StatusMark status={item.entity.status} />
        {item.task.description !== undefined &&
        item.task.description.length > 0 ? (
          <p className="type-body-m" data-detail="description">
            {item.task.description}
          </p>
        ) : null}
        <section data-detail="subtasks">
          <h3 className="type-body-m">{COPY.subtasks}</h3>
          {item.task.subtasks.length === 0 ? (
            <p className="type-body-s">0/0</p>
          ) : (
            <ul>
              {item.task.subtasks.map((subtask) => (
                <li key={subtask.id} className="type-body-m">
                  {subtask.done ? "[x] " : "[ ] "}
                  {subtask.title}
                </li>
              ))}
            </ul>
          )}
          {total > 0 ? (
            <ProgressStatus
              status={item.entity.status}
              value={percent}
              ornament="dense"
            />
          ) : null}
        </section>
        <section data-detail="blocks">
          <h3 className="type-body-m">{COPY.blocksHeading}</h3>
          {owned.length === 0 ? (
            <p className="type-body-s">{COPY.noBlocks}</p>
          ) : (
            <ul>
              {owned.map((block) => (
                <li key={block.id} className="type-body-s">
                  {block.id}: {formatNearestBlock(block)}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section data-detail="focus">
          <h3 className="type-body-m">{COPY.focusHeading}</h3>
          {item.entity.focusHistory.length === 0 ? (
            <p className="type-body-s">{COPY.noFocus}</p>
          ) : (
            <ul>
              {item.entity.focusHistory.map((sessionId) => (
                <li key={sessionId} className="type-body-s">
                  {sessionId}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section data-detail="recurrence">
          <h3 className="type-body-m">{COPY.recurrenceHeading}</h3>
          <p className="type-body-s">
            {item.task.repeatWeekdays
              ? weekdayNames(item.task.repeatWeekdays)
              : COPY.oneOff}
            {item.entity.kind === "occurrence" ? ` · ${item.entity.date}` : ""}
          </p>
        </section>
        <section data-detail="source">
          <h3 className="type-body-m">{COPY.sourceHeading}</h3>
          {source.kind === "user" ? (
            <p className="type-body-s">
              {COPY.sourceCreator}: {source.accountId} ({source.kind})
            </p>
          ) : (
            <p className="type-body-s">
              {COPY.sourceCreator}: {source.sourceName} · {source.sourceMark} ·{" "}
              {source.itemKey}
            </p>
          )}
        </section>
        <section data-detail="history">
          <h3 className="type-body-m">{COPY.historyHeading}</h3>
          <ul>
            {entityHistory.map((event) => (
              <li key={event.id} className="type-body-s">
                {event.status} · {event.workieDay} · {String(event.at)}
              </li>
            ))}
          </ul>
        </section>
        <Button
          type="button"
          variant="secondary"
          size="primary"
          ornament="dense"
          onClick={onClose}
        >
          {COPY.closeDetail}
        </Button>
      </div>
    </Panel>
  );
}
