import type { FormEvent } from "react";
import {
  type ChainId,
  type ConflictResolution,
  type DayPlan,
  type MutationPreview,
  type OverloadReport,
  CONFLICT_RESOLUTIONS,
  conflictInfos,
  finishPreview,
  isFlexibleBlock,
  packDay,
  resolveConflict,
} from "../calendar/index";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { StatusMark } from "../ui/StatusMark";
import { COPY, CONFLICT_RESOLUTION_COPY } from "./copy";
import { formatSpan, hmFromMs, msFromHm } from "./format";
import type { ScheduleDraft } from "./schedule";
import { chainLabel, previewFromDraft, previewRows } from "./schedule";

type PreviewDialogProps = {
  plan: DayPlan;
  preview: MutationPreview;
  taskTitles: ReadonlyMap<string, string>;
  onApply: () => void;
  onCancel: () => void;
};

export function PreviewDialog({
  plan,
  preview,
  taskTitles,
  onApply,
  onCancel,
}: PreviewDialogProps) {
  const rows = previewRows(plan, preview, taskTitles);
  return (
    <Panel title={COPY.previewTitle} role="dialog" ornament="panel">
      <p className="type-body-s">{COPY.resultingTimes}</p>
      <ul className="timeline-preview-list">
        {rows.map((row) => (
          <li key={row.id}>
            {row.title}: {row.span}
            {row.conflict ? ` · ${COPY.conflict}` : ""}
          </li>
        ))}
      </ul>
      <p className="type-body-s">{COPY.affectedChains}</p>
      <ul className="timeline-preview-list">
        {preview.affectedChains.length === 0 ? (
          <li>None</li>
        ) : (
          preview.affectedChains.map((chain) => (
            <li key={chain === null ? "day-start" : chain}>
              {chainLabel(chain)}
            </li>
          ))
        )}
      </ul>
      <div className="timeline-actions">
        <Button
          type="button"
          variant="primary"
          size="primary"
          onClick={onApply}
        >
          {COPY.applyPreview}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="primary"
          onClick={onCancel}
        >
          {COPY.cancel}
        </Button>
      </div>
    </Panel>
  );
}

type ScheduleDialogProps = {
  plan: DayPlan;
  draft: ScheduleDraft;
  taskTitles: ReadonlyMap<string, string>;
  onChange: (draft: ScheduleDraft) => void;
  onApply: (preview: MutationPreview) => void;
  onCancel: () => void;
};

export function ScheduleDialog({
  plan,
  draft,
  taskTitles,
  onChange,
  onApply,
  onCancel,
}: ScheduleDialogProps) {
  const packed = packDay(plan);
  const clock = hmFromMs(draft.startMs);
  const live = previewFromDraft(plan, draft);
  const rows = live ? previewRows(plan, live, taskTitles) : [];

  function handleStart(hour: number, minute: number) {
    onChange({
      ...draft,
      startMs: msFromHm(packed.dayStartMs, hour, minute),
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (live === null) {
      return;
    }
    onApply(live);
  }

  return (
    <Panel title={COPY.scheduleOnTimeline} role="dialog" ornament="panel">
      <form onSubmit={handleSubmit}>
        <p className="type-body-m">{COPY.chooseType}</p>
        <div className="timeline-actions">
          <Button
            type="button"
            variant="secondary"
            size="primary"
            aria-pressed={draft.type === "fixed"}
            onClick={() => onChange({ ...draft, type: "fixed" })}
          >
            {COPY.fixed}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="primary"
            aria-pressed={draft.type === "flexible"}
            onClick={() => onChange({ ...draft, type: "flexible" })}
          >
            {COPY.flexible}
          </Button>
        </div>
        <label className="timeline-field type-body-s">
          {COPY.startTime}
          <span>
            <input
              type="number"
              min={0}
              max={23}
              value={clock.hour}
              aria-label="Start hour"
              onChange={(event) =>
                handleStart(Number(event.target.value), clock.minute)
              }
            />
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              value={clock.minute}
              aria-label="Start minute"
              onChange={(event) =>
                handleStart(clock.hour, Number(event.target.value))
              }
            />
          </span>
        </label>
        <label className="timeline-field type-body-s">
          {COPY.duration}
          <input
            type="number"
            min={5}
            step={5}
            value={Math.round(draft.durationMs / 60_000)}
            aria-label={COPY.duration}
            onChange={(event) =>
              onChange({
                ...draft,
                durationMs: Math.max(5, Number(event.target.value)) * 60_000,
              })
            }
          />
        </label>
        {live ? (
          <>
            <p className="type-body-s">{COPY.resultingTimes}</p>
            <ul className="timeline-preview-list">
              {rows.map((row) => (
                <li key={row.id}>
                  {row.title}: {row.span}
                </li>
              ))}
            </ul>
            <p className="type-body-s">{COPY.affectedChains}</p>
            <ul className="timeline-preview-list">
              {live.affectedChains.map((chain) => (
                <li key={chain === null ? "day-start" : chain}>
                  {chainLabel(chain)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="timeline-actions">
          <Button
            type="submit"
            variant="primary"
            size="primary"
            disabled={live === null}
          >
            {COPY.applyPreview}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="primary"
            onClick={onCancel}
          >
            {COPY.cancel}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

type ConflictPanelProps = {
  plan: DayPlan;
  onPropose: (preview: MutationPreview) => void;
};

export function ConflictPanel({ plan, onPropose }: ConflictPanelProps) {
  const packed = packDay(plan);
  const infos = conflictInfos(packed);
  const markedIds = new Set(infos.flatMap((item) => item.affectedBlockIds));
  const conflicts = packed.blocks.filter(
    (block) => block.conflict || markedIds.has(block.id),
  );
  if (conflicts.length === 0) {
    return null;
  }

  const colliding = plan.blocks.find((block) => block.conflict);
  const durationDefault = colliding
    ? Math.max(5, Math.round(colliding.durationMs / 60_000 / 2 / 5) * 5)
    : 15;
  const orderDefault =
    colliding && isFlexibleBlock(colliding) ? colliding.chainPosition : 0;

  function run(
    resolution: ConflictResolution,
    extra?: {
      durationMs?: number;
      chainPosition?: number;
      blockId?: string;
    },
  ) {
    const blockId = extra?.blockId ?? colliding?.id;
    if (resolution === "keepConflict") {
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
      return;
    }
    if (!blockId) {
      return;
    }
    if (resolution === "changeDuration") {
      onPropose(
        resolveConflict(
          plan,
          {
            resolution: "changeDuration",
            blockId,
            durationMs: extra?.durationMs ?? durationDefault * 60_000,
          },
          { confirmed: false },
        ),
      );
      return;
    }
    if (resolution === "changeOrder") {
      onPropose(
        resolveConflict(
          plan,
          {
            resolution: "changeOrder",
            blockId,
            chainPosition: extra?.chainPosition ?? orderDefault,
          },
          { confirmed: false },
        ),
      );
      return;
    }
    if (resolution === "moveBlockPastAnchor") {
      onPropose(
        resolveConflict(
          plan,
          { resolution: "moveBlockPastAnchor", blockId },
          { confirmed: false },
        ),
      );
      return;
    }
    onPropose(
      resolveConflict(
        plan,
        { resolution: "unscheduleBlock", blockId },
        { confirmed: false },
      ),
    );
  }

  return (
    <section className="timeline-banner ui-ornament" data-ornament="dense">
      <div className="ui-ornament-content">
        <StatusMark status="Conflict" />
        <ul className="timeline-conflict-list">
          {conflicts.map((block) => (
            <li key={block.id}>
              {block.id}: {formatSpan(block.derivedStartMs, block.derivedEndMs)}
            </li>
          ))}
        </ul>
        <form
          className="timeline-actions"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const durationMs = Number(data.get("duration")) * 60_000;
            const chainPosition = Number(data.get("order"));
            const resolution = data.get("resolution") as ConflictResolution;
            run(resolution, { durationMs, chainPosition });
          }}
        >
          <label className="timeline-field type-body-s">
            {COPY.duration}
            <input
              name="duration"
              type="number"
              min={5}
              step={5}
              defaultValue={durationDefault}
            />
          </label>
          <label className="timeline-field type-body-s">
            {COPY.chainPosition}
            <input
              name="order"
              type="number"
              min={0}
              defaultValue={orderDefault}
            />
          </label>
          {CONFLICT_RESOLUTIONS.map((resolution) => (
            <Button
              key={resolution}
              type="submit"
              name="resolution"
              value={resolution}
              variant="secondary"
              size="primary"
            >
              {CONFLICT_RESOLUTION_COPY[resolution]}
            </Button>
          ))}
        </form>
      </div>
    </section>
  );
}

type OverloadBannerProps = {
  report: OverloadReport;
  onKeepAnyway: () => void;
};

export function OverloadBanner({ report, onKeepAnyway }: OverloadBannerProps) {
  if (!report.overloaded) {
    return null;
  }
  return (
    <section className="timeline-banner ui-ornament" data-ornament="dense">
      <div className="ui-ornament-content">
        <p className="type-body-m">{COPY.overloaded}</p>
        <ul className="timeline-preview-list">
          {report.issues.map((issue, index) => {
            if (issue.kind === "overlappingFixed") {
              return (
                <li key={`overlap-${index}`}>
                  {issue.blockIds.join(", ")}{" "}
                  {formatSpan(issue.span.startMs, issue.span.endMs)}
                </li>
              );
            }
            if (issue.kind === "chainExceedsCapacity") {
              return (
                <li key={`cap-${index}`}>
                  {issue.blockIds.join(", ")}{" "}
                  {formatSpan(issue.span.startMs, issue.span.endMs)}
                </li>
              );
            }
            return (
              <li key={`conflict-${index}`}>{issue.blockIds.join(", ")}</li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="secondary"
          size="primary"
          onClick={onKeepAnyway}
        >
          {COPY.keepAnyway}
        </Button>
      </div>
    </section>
  );
}

export function chainKeyOf(chain: ChainId): string {
  return chain === null ? "day-start" : chain;
}
