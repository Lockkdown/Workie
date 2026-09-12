import {
  type DragEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type CalendarDayClose,
  type DayPlan,
  type MutationPreview,
  type PackedBlock,
  evaluateCalendarDayClose,
  evaluateOverload,
  conflictInfos,
  finishPreview,
  isFlexibleBlock,
  isReserveBlock,
  packDay,
  resolveConflict,
  warnBeforeEndOfRunning,
} from "../calendar/index";
import { parseTaskDrag, readTaskDrag } from "../desk/taskDrag";
import type { Task } from "../domain/types";
import { workieDayKey } from "../domain/workieDay";
import { newId } from "../id";
import { Button } from "../ui/Button";
import { TimeBlock } from "../ui/TimeBlock";
import type { TaskStatus } from "../ui/types";
import { readBlockDrag, writeBlockDrag } from "./blockDrag";
import { AXIS_HEIGHT_PX, DEFAULT_DURATION_MS, SNAP_MS } from "./constants";
import { COPY } from "./copy";
import {
  formatHm,
  heightPxFromDuration,
  hourLabels,
  topPxFromMs,
} from "./format";
import { OfflineIcon, WarningIcon } from "./icons";
import { slotFromAxisY } from "./placement";
import {
  ConflictPanel,
  OverloadBanner,
  PreviewDialog,
  ScheduleDialog,
} from "./PreviewPanels";
import { ReserveChrome } from "./ReserveChrome";
import {
  type ScheduleDraft,
  chainTargets,
  previewConvert,
  previewMoveBlock,
  previewMoveToChain,
  previewReorder,
  previewResize,
  previewUnschedule,
} from "./schedule";

export type LoadState = "loading" | "ready" | "error";

export type TimelineSurfaceProps = {
  plan: DayPlan;
  tasks: readonly Task[];
  now: number;
  loadState: LoadState;
  errorCause: string | null;
  offline: boolean;
  saveLabel: string;
  preview: MutationPreview | null;
  partialFailures: Readonly<Record<string, string>>;
  onPropose: (preview: MutationPreview) => void;
  onApply: (preview: MutationPreview) => void;
  onCancel: () => void;
  onRetry: () => void;
  onMarkRunning: (blockId: string | null) => void;
  seedDraft?: ScheduleDraft | null;
  initialSelectedId?: string | null;
  unfinishedCycleStatus?: "awaiting reconciliation";
};

function taskStatus(
  block: PackedBlock,
  tasks: ReadonlyMap<string, Task>,
): TaskStatus | null {
  if (block.kind !== "task") {
    return null;
  }
  return tasks.get(block.taskId)?.status ?? null;
}

export function TimelineSurface({
  plan,
  tasks,
  now,
  loadState,
  errorCause,
  offline,
  saveLabel,
  preview,
  partialFailures,
  onPropose,
  onApply,
  onCancel,
  onRetry,
  onMarkRunning,
  seedDraft = null,
  initialSelectedId = null,
  unfinishedCycleStatus,
}: TimelineSurfaceProps) {
  const axisRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [draft, setDraft] = useState<ScheduleDraft | null>(seedDraft);
  const [moveHour, setMoveHour] = useState(9);
  const [moveMinute, setMoveMinute] = useState(0);
  const [resizeMinutes, setResizeMinutes] = useState(30);
  const [chainTarget, setChainTarget] = useState("");
  const packed = packDay(plan);
  const conflictIds = new Set(
    conflictInfos(packed).flatMap((item) => item.affectedBlockIds),
  );
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const overload = evaluateOverload(plan);
  const fiveMin = warnBeforeEndOfRunning(plan, now);
  const close: CalendarDayClose = evaluateCalendarDayClose(now, {
    plan,
    unfinishedCycleStatus,
  });
  const hours = hourLabels();
  const selected = plan.blocks.find((block) => block.id === selectedId);
  const showNow = workieDayKey(now) === plan.day;

  useEffect(() => {
    if (seedDraft) {
      setDraft(seedDraft);
    }
  }, [seedDraft]);

  function yFromClient(clientY: number): number {
    const node = axisRef.current;
    if (!node) {
      return 0;
    }
    return clientY - node.getBoundingClientRect().top;
  }

  function snapDuration(ms: number): number {
    return Math.max(SNAP_MS, Math.round(ms / SNAP_MS) * SNAP_MS);
  }

  function openReserve(startMs?: number) {
    const place = slotFromAxisY(
      plan,
      startMs === undefined ? 9 * 48 : topPxFromMs(startMs),
    );
    setDraft({
      kind: "reserve",
      type: null,
      startMs: place.startMs,
      durationMs: DEFAULT_DURATION_MS,
      precedingAnchorId: place.precedingAnchorId,
      chainPosition: place.chainPosition,
      id: newId(),
    });
  }

  function handleAxisDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const y = yFromClient(event.clientY);
    const slot = slotFromAxisY(plan, y);
    const task =
      readTaskDrag(event.dataTransfer) ??
      parseTaskDrag(event.dataTransfer.getData("text/plain"));
    if (task) {
      setDraft({
        kind: "task",
        taskId: task.taskId,
        type: null,
        startMs: slot.startMs,
        durationMs: DEFAULT_DURATION_MS,
        precedingAnchorId: slot.precedingAnchorId,
        chainPosition: slot.chainPosition,
        id: newId(),
      });
      return;
    }
    const block = readBlockDrag(event.dataTransfer);
    if (block) {
      onPropose(previewMoveBlock(plan, block.blockId, slot.startMs));
    }
  }

  function handleUnscheduleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const block = readBlockDrag(event.dataTransfer);
    if (block) {
      onPropose(previewUnschedule(plan, block.blockId));
    }
  }

  function handleEdgePointerUp(
    event: PointerEvent<HTMLButtonElement>,
    block: PackedBlock,
    edge: "start" | "end",
  ) {
    const y = yFromClient(event.clientY);
    const timeMs = slotFromAxisY(plan, y).startMs;
    const durationMs =
      edge === "end"
        ? snapDuration(timeMs - block.derivedStartMs)
        : snapDuration(block.derivedEndMs - timeMs);
    onPropose(previewResize(plan, block.id, durationMs));
  }

  return (
    <div className="timeline-surface">
      {offline ? (
        <div
          className="timeline-banner ui-ornament"
          data-ornament="dense"
          role="status"
          data-offline="true"
        >
          <div className="ui-ornament-content">
            <OfflineIcon />
            <span className="type-body-m">{COPY.offline}</span>
            <span className="type-body-s">{saveLabel}</span>
          </div>
        </div>
      ) : null}
      {errorCause ? (
        <div className="timeline-banner ui-ornament" data-ornament="dense">
          <div className="ui-ornament-content">
            <WarningIcon />
            <p className="type-body-m">{errorCause}</p>
            <p className="type-body-s">{COPY.errorUnchanged}</p>
            <Button
              type="button"
              variant="secondary"
              size="primary"
              onClick={onRetry}
            >
              {COPY.retry}
            </Button>
          </div>
        </div>
      ) : null}
      {!close.previousDayClosed ? (
        <div className="timeline-banner ui-ornament" data-ornament="dense">
          <div className="ui-ornament-content">
            <p className="type-body-m">{COPY.dayClosePending}</p>
          </div>
        </div>
      ) : null}
      {fiveMin ? (
        <div
          className="timeline-banner ui-ornament"
          data-ornament="dense"
          data-muted="true"
          data-five-minute="true"
        >
          <div className="ui-ornament-content">
            <WarningIcon />
            <span className="type-body-m">{COPY.fiveMinutes}</span>
          </div>
        </div>
      ) : null}
      <OverloadBanner
        report={overload}
        onKeepAnyway={() => {
          const stamped = finishPreview(plan, plan, false, {
            clearResolved: false,
          });
          onPropose(
            resolveConflict(
              stamped.next,
              { resolution: "keepConflict" },
              { confirmed: false },
            ),
          );
        }}
      />
      <ConflictPanel plan={plan} onPropose={onPropose} />
      <div className="timeline-actions">
        <Button
          type="button"
          variant="secondary"
          size="primary"
          onClick={() => openReserve()}
        >
          {COPY.addReserve}
        </Button>
      </div>
      <div
        className="timeline-unschedule"
        data-calendar-unschedule="true"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleUnscheduleDrop}
      >
        {COPY.dropUnschedule}
      </div>
      {loadState === "ready" && plan.blocks.length === 0 ? (
        <div className="timeline-empty">
          <div className="timeline-empty-motif" aria-hidden="true" />
          <p className="type-body-m">{COPY.emptyStep}</p>
        </div>
      ) : null}
      <div className="timeline-scroll">
        <div
          ref={axisRef}
          className="timeline-axis"
          data-calendar-drop="true"
          data-testid="hour-axis"
          aria-label="Hour axis"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleAxisDrop}
        >
          {hours.map((label, hour) => (
            <div
              key={label}
              className="timeline-hour"
              data-hour={hour}
              style={{ top: hour * 48 }}
            >
              <p className="timeline-hour-label type-body-s">{label}</p>
            </div>
          ))}
          {loadState === "loading" ? (
            <>
              <div className="timeline-skeleton-lane" style={{ top: 48 }} />
              <div className="timeline-skeleton-lane" style={{ top: 144 }} />
            </>
          ) : null}
          {showNow ? (
            <div
              className="timeline-now"
              data-now-marker="true"
              style={{ top: topPxFromMs(now) }}
            >
              <p className="timeline-now-label type-body-s">{formatHm(now)}</p>
            </div>
          ) : null}
          {packed.blocks.map((block) => {
            const top = topPxFromMs(block.derivedStartMs);
            const height = Math.max(
              topPxFromMs(block.derivedEndMs) - top,
              heightPxFromDuration(block.durationMs),
            );
            const status = taskStatus(block, taskMap);
            const failed = partialFailures[block.id];
            const inConflict = block.conflict || conflictIds.has(block.id);
            return (
              <div
                key={block.id}
                className="timeline-block timeline-block--moved"
                data-block-id={block.id}
                data-running={
                  plan.runningBlockId === block.id ? "true" : "false"
                }
                data-conflict={inConflict ? "true" : "false"}
                style={{ top, height }}
                draggable
                onDragStart={(event) => {
                  writeBlockDrag(event.dataTransfer, { blockId: block.id });
                }}
                onClick={() => setSelectedId(block.id)}
              >
                {isReserveBlock(block) ? (
                  <ReserveChrome blockType={block.type} conflict={inConflict} />
                ) : status !== null ? (
                  <TimeBlock
                    status={status}
                    blockType={block.type}
                    title={titles.get(block.taskId) ?? block.taskId}
                    conflict={inConflict}
                  />
                ) : (
                  <ReserveChrome
                    blockType={block.type}
                    conflict={inConflict}
                    title={block.kind === "task" ? block.taskId : COPY.reserve}
                    reserve={false}
                  />
                )}
                {failed ? (
                  <p className="timeline-partial type-body-s">
                    {COPY.partialFailure} {failed}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="timeline-edge"
                  data-edge="start"
                  aria-label={COPY.resizeStart}
                  onPointerUp={(event) =>
                    handleEdgePointerUp(event, block, "start")
                  }
                />
                <button
                  type="button"
                  className="timeline-edge"
                  data-edge="end"
                  aria-label={COPY.resizeEnd}
                  onPointerUp={(event) =>
                    handleEdgePointerUp(event, block, "end")
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      {selected ? (
        <div className="timeline-actions" aria-label="Block actions">
          <label className="timeline-field type-body-s">
            {COPY.moveBlock}
            <span>
              <input
                type="number"
                min={0}
                max={23}
                value={moveHour}
                aria-label="Move hour"
                onChange={(event) => setMoveHour(Number(event.target.value))}
              />
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={moveMinute}
                aria-label="Move minute"
                onChange={(event) => setMoveMinute(Number(event.target.value))}
              />
            </span>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="primary"
            onClick={() => {
              const startMs = slotFromAxisY(
                plan,
                (moveHour * 60 + moveMinute) * (AXIS_HEIGHT_PX / (24 * 60)),
              ).startMs;
              onPropose(previewMoveBlock(plan, selected.id, startMs));
            }}
          >
            {COPY.moveBlock}
          </Button>
          <label className="timeline-field type-body-s">
            {COPY.resize}
            <input
              type="number"
              min={5}
              step={5}
              value={resizeMinutes}
              aria-label={COPY.resize}
              onChange={(event) => setResizeMinutes(Number(event.target.value))}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            size="primary"
            onClick={() =>
              onPropose(
                previewResize(plan, selected.id, resizeMinutes * 60_000),
              )
            }
          >
            {COPY.resize}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="primary"
            onClick={() => onPropose(previewUnschedule(plan, selected.id))}
          >
            {COPY.unschedule}
          </Button>
          {isFlexibleBlock(selected) ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={() => onPropose(previewReorder(plan, selected.id, -1))}
              >
                {COPY.moveEarlier}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={() => onPropose(previewReorder(plan, selected.id, 1))}
              >
                {COPY.moveLater}
              </Button>
              <span className="type-body-s">{COPY.reorderInChain}</span>
              <label className="timeline-field type-body-s">
                {COPY.moveToChain}
                <select
                  aria-label={COPY.moveToChain}
                  value={chainTarget}
                  onChange={(event) => setChainTarget(event.target.value)}
                >
                  {chainTargets(plan).map((target) => (
                    <option
                      key={target.id === "" ? "day-start" : target.id}
                      value={target.id}
                    >
                      {target.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={() =>
                  onPropose(
                    previewMoveToChain(
                      plan,
                      selected.id,
                      chainTarget === "" ? null : chainTarget,
                    ),
                  )
                }
              >
                {COPY.moveToChain}
              </Button>
            </>
          ) : null}
          {selected.type === "fixed" ? (
            <Button
              type="button"
              variant="secondary"
              size="primary"
              onClick={() =>
                onPropose(previewConvert(plan, selected.id, "flexible"))
              }
            >
              {COPY.makeFlexible}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="primary"
              onClick={() =>
                onPropose(previewConvert(plan, selected.id, "fixed"))
              }
            >
              {COPY.makeFixed}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="primary"
            onClick={() =>
              onMarkRunning(
                plan.runningBlockId === selected.id ? null : selected.id,
              )
            }
          >
            {plan.runningBlockId === selected.id
              ? COPY.clearRunning
              : COPY.markAsRunning}
          </Button>
        </div>
      ) : null}
      {draft && preview === null ? (
        <ScheduleDialog
          plan={plan}
          draft={draft}
          taskTitles={titles}
          onChange={setDraft}
          onApply={(next) => {
            setDraft(null);
            onApply(next);
          }}
          onCancel={() => setDraft(null)}
        />
      ) : null}
      {preview ? (
        <PreviewDialog
          plan={plan}
          preview={preview}
          taskTitles={titles}
          onApply={() => onApply(preview)}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  );
}

export function openScheduleDraftForTask(
  plan: DayPlan,
  taskId: string,
): ScheduleDraft {
  const place = slotFromAxisY(plan, 9 * 48);
  return {
    kind: "task",
    taskId,
    type: null,
    startMs: place.startMs,
    durationMs: DEFAULT_DURATION_MS,
    precedingAnchorId: place.precedingAnchorId,
    chainPosition: place.chainPosition,
    id: newId(),
  };
}

export function openScheduleDraftForReserve(plan: DayPlan): ScheduleDraft {
  const place = slotFromAxisY(plan, 9 * 48);
  return {
    kind: "reserve",
    type: null,
    startMs: place.startMs,
    durationMs: DEFAULT_DURATION_MS,
    precedingAnchorId: place.precedingAnchorId,
    chainPosition: place.chainPosition,
    id: newId(),
  };
}
