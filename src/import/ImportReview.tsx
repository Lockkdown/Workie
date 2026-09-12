import type { JSX } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { ConstraintField, WorkieForm } from "../ui/WorkieForm";
import { COPY } from "./copy";
import { itemPartialError } from "./reviewState";
import type { DuplicateLevel, ReviewItem, ReviewSession } from "./types";
import "./import.css";

export type ImportReviewViewProps = {
  session: ReviewSession;
  online: boolean;
  loading: boolean;
  error?: string;
  discardConfirming: boolean;
  committing: boolean;
  draftSavedAt?: number;
  onTitle: (itemKey: string, title: string) => void;
  onDescription: (itemKey: string, description: string) => void;
  onSelect: (itemKey: string, selected: boolean) => void;
  onAddAnyway: (itemKey: string) => void;
  onCompare: (itemKey: string) => void;
  onMove: (itemKey: string, direction: -1 | 1) => void;
  onAddSubtask: (itemKey: string) => void;
  onEditSubtask: (itemKey: string, index: number, title: string) => void;
  onRemoveSubtask: (itemKey: string, index: number) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onKeepReview: () => void;
  onConfirmDiscard: () => void;
};

function DuplicateMark({ level }: { level: DuplicateLevel }): JSX.Element {
  const label =
    level === "Certain duplicate"
      ? COPY.certainDuplicate
      : level === "Possible duplicate"
        ? COPY.possibleDuplicate
        : COPY.newItem;
  const slug =
    level === "Certain duplicate"
      ? "certain"
      : level === "Possible duplicate"
        ? "possible"
        : "new";
  return (
    <span className="import-dup" data-duplicate={level} data-level={slug}>
      <span className="import-dup-accent" aria-hidden="true" />
      <svg
        viewBox="0 0 16 16"
        width={16}
        height={16}
        data-icon={`duplicate-${slug}`}
        aria-hidden="true"
        focusable="false"
      >
        {level === "Certain duplicate" ? (
          <path
            d="M4 5h7v7H4zM6 3h7v7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        ) : level === "Possible duplicate" ? (
          <>
            <circle
              cx="8"
              cy="8"
              r="5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 7.5V11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M8 5.2h.01" stroke="currentColor" strokeWidth="2" />
          </>
        ) : (
          <path
            d="M8 3v10M3 8h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        )}
      </svg>
      <span className="import-dup-label type-body-s">{label}</span>
    </span>
  );
}

function OfflineBanner({ online }: { online: boolean }): JSX.Element | null {
  if (online) {
    return null;
  }
  return (
    <div className="import-offline" role="status" data-offline="true">
      <svg
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

function ReviewItemCard({
  item,
  index,
  total,
  session,
  onTitle,
  onDescription,
  onSelect,
  onAddAnyway,
  onCompare,
  onMove,
  onAddSubtask,
  onEditSubtask,
  onRemoveSubtask,
}: {
  item: ReviewItem;
  index: number;
  total: number;
  session: ReviewSession;
  onTitle: ImportReviewViewProps["onTitle"];
  onDescription: ImportReviewViewProps["onDescription"];
  onSelect: ImportReviewViewProps["onSelect"];
  onAddAnyway: ImportReviewViewProps["onAddAnyway"];
  onCompare: ImportReviewViewProps["onCompare"];
  onMove: ImportReviewViewProps["onMove"];
  onAddSubtask: ImportReviewViewProps["onAddSubtask"];
  onEditSubtask: ImportReviewViewProps["onEditSubtask"];
  onRemoveSubtask: ImportReviewViewProps["onRemoveSubtask"];
}): JSX.Element {
  const titleId = `import-title-${item.itemKey}`;
  const descId = `import-desc-${item.itemKey}`;
  const comparing = session.compareKeys.includes(item.itemKey);
  const showDiff =
    item.contentChanged || item.duplicate === "Possible duplicate" || comparing;
  const partial = itemPartialError(session, item.itemKey);
  const certainUnselected =
    item.duplicate === "Certain duplicate" && !item.selected;

  return (
    <article
      className="import-item"
      data-item-key={item.itemKey}
      data-partial={partial ? "true" : undefined}
    >
      <div className="import-item-head">
        <DuplicateMark level={item.duplicate} />
        <label className="type-body-s">
          <input
            type="checkbox"
            checked={item.selected}
            disabled={certainUnselected}
            aria-label={`${COPY.selectTask}: ${item.title}`}
            onChange={(event) => onSelect(item.itemKey, event.target.checked)}
          />{" "}
          {COPY.selectTask}
        </label>
        {item.duplicate === "Certain duplicate" && !item.selected ? (
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => onAddAnyway(item.itemKey)}
          >
            {COPY.addAnyway}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={() => onCompare(item.itemKey)}
        >
          {COPY.compare}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          disabled={index === 0}
          onClick={() => onMove(item.itemKey, -1)}
        >
          {COPY.moveUp}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          disabled={index === total - 1}
          onClick={() => onMove(item.itemKey, 1)}
        >
          {COPY.moveDown}
        </Button>
      </div>
      <p className="import-meta-read type-body-s">
        {COPY.itemKey}: {item.itemKey}
      </p>
      <div className="import-fields">
        <label className="type-body-m" htmlFor={titleId}>
          {COPY.title}
          <ConstraintField
            fieldId={titleId}
            extraMessage={
              item.selected && item.title.trim().length === 0
                ? `Task ${item.itemKey}: title is required.`
                : undefined
            }
          >
            <input
              className="type-body-m"
              required={item.selected}
              aria-required={item.selected || undefined}
              value={item.title}
              onChange={(event) => onTitle(item.itemKey, event.target.value)}
            />
          </ConstraintField>
        </label>
        <label className="type-body-m" htmlFor={descId}>
          {COPY.description}
          <ConstraintField
            fieldId={descId}
            extraMessage={
              item.selected &&
              item.title.trim().length > 0 &&
              item.description.trim().length === 0
                ? `Task ${item.itemKey}: description is required.`
                : undefined
            }
          >
            <textarea
              className="type-body-m"
              rows={3}
              required={item.selected}
              aria-required={item.selected || undefined}
              value={item.description}
              onChange={(event) =>
                onDescription(item.itemKey, event.target.value)
              }
            />
          </ConstraintField>
        </label>
      </div>
      <fieldset className="import-subtasks">
        <legend className="type-body-m">{COPY.subtasks}</legend>
        {item.subtasks.map((subtask, subIndex) => (
          <div
            className="import-row"
            key={`${item.itemKey}-sub-${String(subIndex)}`}
          >
            <label className="type-body-s">
              {COPY.subtasks} {String(subIndex + 1)}
              <input
                className="type-body-m"
                value={subtask.title}
                onChange={(event) =>
                  onEditSubtask(item.itemKey, subIndex, event.target.value)
                }
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => onRemoveSubtask(item.itemKey, subIndex)}
            >
              {COPY.removeSubtask}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={() => onAddSubtask(item.itemKey)}
        >
          {COPY.addSubtask}
        </Button>
      </fieldset>
      {showDiff && item.matchedTaskId ? (
        <div className="import-compare" data-compare="true">
          <p className="type-body-s">
            {COPY.existing}: {item.localTitle}
          </p>
          <p className="type-body-s">
            {COPY.incoming}: {item.title}
          </p>
          <p className="type-body-s">
            {COPY.existing} {COPY.description}: {item.localDescription}
          </p>
          <p className="type-body-s">
            {COPY.incoming} {COPY.description}: {item.description}
          </p>
        </div>
      ) : null}
      {partial ? (
        <p className="import-error type-body-s" role="status">
          {partial}
        </p>
      ) : null}
    </article>
  );
}

export function ImportReviewView({
  session,
  online,
  loading,
  error,
  discardConfirming,
  committing,
  draftSavedAt = 0,
  onTitle,
  onDescription,
  onSelect,
  onAddAnyway,
  onCompare,
  onMove,
  onAddSubtask,
  onEditSubtask,
  onRemoveSubtask,
  onConfirm,
  onDiscard,
  onKeepReview,
  onConfirmDiscard,
}: ImportReviewViewProps): JSX.Element {
  const canSubmit = !committing && !loading;

  const layer = (
    <div
      className="import-review-layer"
      data-draft-saved={String(draftSavedAt)}
    >
      <Panel title={COPY.reviewTitle} ornament="panel" role="dialog">
        <WorkieForm
          className="import-review-body"
          onValidSubmit={() => {
            onConfirm();
          }}
        >
          <OfflineBanner online={online} />
          {loading ? (
            <div
              className="import-skeleton"
              data-state="loading"
              aria-busy="true"
            >
              <p className="type-body-m">{COPY.loading}</p>
            </div>
          ) : null}
          {error ? (
            <p className="import-error type-body-m" role="alert">
              {error}
            </p>
          ) : null}
          <div className="import-meta">
            <p className="import-meta-read type-body-m">
              {COPY.sourceName}: {session.sourceName}
            </p>
            <p className="import-meta-read type-body-m">{COPY.claudeCowork}</p>
            <p className="import-meta-read type-body-s">
              {COPY.sourceMark}: {session.sourceMark}
            </p>
          </div>
          {session.items.map((item, index) => (
            <ReviewItemCard
              key={item.itemKey}
              item={item}
              index={index}
              total={session.items.length}
              session={session}
              onTitle={onTitle}
              onDescription={onDescription}
              onSelect={onSelect}
              onAddAnyway={onAddAnyway}
              onCompare={onCompare}
              onMove={onMove}
              onAddSubtask={onAddSubtask}
              onEditSubtask={onEditSubtask}
              onRemoveSubtask={onRemoveSubtask}
            />
          ))}
          <div className="import-actions">
            {discardConfirming ? (
              <>
                <p className="type-body-m">{COPY.discardPrompt}</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onKeepReview}
                >
                  {COPY.keepReview}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onConfirmDiscard}
                >
                  {COPY.confirmDiscard}
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={onDiscard}>
                {COPY.discard}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              {COPY.confirm}
            </Button>
          </div>
        </WorkieForm>
      </Panel>
    </div>
  );

  if (typeof document === "undefined") {
    return layer;
  }
  return createPortal(layer, document.body);
}
