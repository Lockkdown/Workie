import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isFixedBlock, packDay } from "../calendar/index";
import {
  loadTaskState,
  persistEnsureTomorrowOccurrences,
} from "../db/taskPersistence";
import { tomorrowWorkieDay, workieDayKey } from "../domain/workieDay";
import { appDb } from "./appDb";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { COPY } from "../planning/copy";
import {
  commitPlanToCalendar,
  loadCarryOverIds,
  loadCommittedOrEmpty,
  loadPlanningDocument,
  savePlanningDocument,
} from "../planning/persist";
import { namedReviewIssues } from "../planning/review";
import {
  commitDocument,
  emptyDocument,
  isCommitment,
  mayCommit,
  markKeepAnyway,
  needsKeepAnyway,
  placeFixed,
  placeFlexible,
  placedBlocksForCommit,
  setStep,
  toggleSelected,
} from "../planning/ritual";
import { buildTray, trayGroupOrder } from "../planning/tray";
import type { PlanningDocument, TrayItem } from "../planning/types";
import "../planning/planning.css";

function subscribeOnline(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

export function PlanTomorrow() {
  const db = appDb;
  const [now] = useState(() => Date.now());
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorCause, setErrorCause] = useState<string | null>(null);
  const [doc, setDoc] = useState<PlanningDocument | null>(null);
  const docRef = useRef<PlanningDocument | null>(null);
  const [items, setItems] = useState<TrayItem[]>([]);
  const [saveLabel, setSaveLabel] = useState<string>(COPY.savedLocally);
  const [flourish, setFlourish] = useState(false);
  const [partial, setPartial] = useState<Record<string, string>>({});
  const [placeFor, setPlaceFor] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState(30);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [chainPosition, setChainPosition] = useState(0);
  const [anchorId, setAnchorId] = useState("");
  const online = useSyncExternalStore(
    subscribeOnline,
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
    () => true,
  );
  const tomorrow = tomorrowWorkieDay(now);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await persistEnsureTomorrowOccurrences(db, now);
        const [state, todayPlan, existing, carry] = await Promise.all([
          loadTaskState(db),
          loadCommittedOrEmpty(db, workieDayKey(now)),
          loadPlanningDocument(db, tomorrow),
          loadCarryOverIds(db, workieDayKey(now)),
        ]);
        if (cancelled) {
          return;
        }
        const groups = buildTray({
          now,
          tasks: state.tasks,
          occurrences: state.occurrences,
          todayPlan,
          carryOverIds: carry,
        });
        setItems(trayGroupOrder().flatMap((name) => groups[name]));
        const initial = existing ?? emptyDocument(tomorrow, now);
        docRef.current = initial;
        setDoc(initial);
        setLoadState("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setErrorCause(
            error instanceof Error ? error.message : COPY.draftError,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, now, tomorrow]);

  async function persist(next: PlanningDocument): Promise<void> {
    docRef.current = next;
    setDoc(next);
    try {
      await savePlanningDocument(db, next);
      setSaveLabel(COPY.savedLocally);
      setErrorCause(null);
    } catch (error) {
      setSaveLabel(COPY.savePending);
      setErrorCause(error instanceof Error ? error.message : COPY.draftError);
    }
  }

  function mutate(mutator: (current: PlanningDocument) => PlanningDocument) {
    const current = docRef.current;
    if (!current) {
      return;
    }
    void persist(mutator(current));
  }

  const groups = useMemo(() => {
    const map = {
      "Unfinished today": [] as TrayItem[],
      "Repeating tomorrow": [] as TrayItem[],
      "Live tasks": [] as TrayItem[],
    };
    for (const item of items) {
      map[item.group].push(item);
    }
    return map;
  }, [items]);
  const byId = new Map(items.map((item) => [item.id, item]));
  const selectedItems = (doc?.selectedIds ?? [])
    .map((id) => byId.get(id))
    .filter((item): item is TrayItem => item !== undefined);
  const reviewPlan = doc ? placedBlocksForCommit(doc) : null;
  const issues = reviewPlan ? namedReviewIssues(reviewPlan) : [];
  const emptyTray = loadState === "ready" && items.length === 0;
  const primary =
    doc && loadState === "ready"
      ? doc.step === 1
        ? {
            label: COPY.continuePlace,
            onClick: () => mutate((current) => setStep(current, 2, Date.now())),
          }
        : doc.step === 2
          ? {
              label: COPY.continueReview,
              onClick: () =>
                mutate((current) => setStep(current, 3, Date.now())),
            }
          : mayCommit(doc)
            ? {
                label: COPY.commitTomorrow,
                onClick: () => {
                  void (async () => {
                    const current = docRef.current;
                    if (!current) {
                      return;
                    }
                    const committed = commitDocument(current, Date.now());
                    const existing = await loadCommittedOrEmpty(
                      db,
                      committed.day,
                    );
                    await commitPlanToCalendar(
                      db,
                      existing,
                      committed.plan,
                      Date.now(),
                    );
                    await persist(committed);
                    setFlourish(!reducedMotion());
                  })();
                },
              }
            : null
      : null;

  return (
    <div className="plan-tomorrow plan-ritual">
      <Panel title={COPY.title} ornament="panel">
        {!online ? (
          <p className="type-body-s">
            {COPY.offline} · {saveLabel}
          </p>
        ) : (
          <p className="type-body-s">{saveLabel}</p>
        )}
        {loadState === "loading" ? (
          <div className="plan-groups" aria-label={COPY.loading}>
            {trayGroupOrder().map((name) => (
              <div key={name} className="plan-skeleton-group" />
            ))}
          </div>
        ) : null}
        {errorCause ? (
          <div>
            <p className="type-body-m">{errorCause}</p>
            <p className="type-body-s">{COPY.draftKept}</p>
            <Button
              type="button"
              variant="secondary"
              size="primary"
              onClick={() => window.location.reload()}
            >
              {COPY.retry}
            </Button>
          </div>
        ) : null}
        <ol className="plan-steps type-body-s">
          <li aria-current={doc?.step === 1 ? "step" : undefined}>
            1. {COPY.stepSelect}
          </li>
          <li aria-current={doc?.step === 2 ? "step" : undefined}>
            2. {COPY.stepPlace}
          </li>
          <li aria-current={doc?.step === 3 ? "step" : undefined}>
            3. {COPY.stepReview}
          </li>
        </ol>
        {emptyTray ? (
          <div>
            <div className="timeline-empty-motif" aria-hidden="true" />
            <p className="type-body-m">{COPY.empty}</p>
          </div>
        ) : null}
        {doc && loadState === "ready" && doc.step === 1 ? (
          <div className="plan-groups">
            {trayGroupOrder().map((name) => (
              <section key={name} aria-label={name}>
                <h3 className="type-display-m">{name}</h3>
                {groups[name].map((item) => (
                  <div key={item.id} className="plan-item">
                    <label className="type-body-m">
                      <input
                        type="checkbox"
                        checked={doc.selectedIds.includes(item.id)}
                        onChange={() =>
                          mutate((current) =>
                            toggleSelected(current, item.id, Date.now()),
                          )
                        }
                      />
                      <span>
                        {item.title}
                        {item.date ? ` · ${item.date}` : ""}
                      </span>
                    </label>
                    <p className="type-body-s">
                      {COPY.whyPrefix}: {item.reason}
                    </p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : null}
        {doc && doc.step === 2 ? (
          <div className="plan-groups">
            {selectedItems.map((item) => (
              <div key={item.id} className="plan-item">
                <p className="type-body-m">{item.title}</p>
                {isCommitment(doc, item.id) ? (
                  <p className="type-body-s">
                    {packDay(doc.plan)
                      .blocks.filter((block) =>
                        doc.owners.some(
                          (owner) =>
                            owner.entityId === item.id &&
                            owner.blockId === block.id,
                        ),
                      )
                      .map((block) => {
                        const time = `${new Date(block.derivedStartMs).toLocaleTimeString()}–${new Date(block.derivedEndMs).toLocaleTimeString()}`;
                        return `${block.type} ${time}`;
                      })
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="type-body-s">{COPY.notCommitment}</p>
                )}
                <div className="plan-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    onClick={() => setPlaceFor(`${item.id}:fixed`)}
                  >
                    {COPY.addFixed}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    onClick={() => setPlaceFor(`${item.id}:flexible`)}
                  >
                    {COPY.addFlexible}
                  </Button>
                </div>
                {placeFor === `${item.id}:fixed` ? (
                  <form
                    className="plan-fields"
                    onSubmit={(event) => {
                      event.preventDefault();
                      try {
                        mutate((current) => {
                          const placed = placeFixed({
                            doc: current,
                            item,
                            blockId: crypto.randomUUID(),
                            startHour,
                            startMinute,
                            durationMs: durationMin * 60_000,
                            now: Date.now(),
                          }).doc;
                          return placed;
                        });
                        setPlaceFor(null);
                      } catch (error) {
                        setPartial((current) => ({
                          ...current,
                          [item.id]:
                            error instanceof Error
                              ? error.message
                              : COPY.partialFailure,
                        }));
                      }
                    }}
                  >
                    <label className="type-body-s">
                      {COPY.startHour}
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={startHour}
                        onChange={(event) =>
                          setStartHour(Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="type-body-s">
                      {COPY.startMinute}
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={startMinute}
                        onChange={(event) =>
                          setStartMinute(Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="type-body-s">
                      {COPY.duration}
                      <input
                        type="number"
                        min={5}
                        value={durationMin}
                        onChange={(event) =>
                          setDurationMin(Number(event.target.value))
                        }
                      />
                    </label>
                    <Button type="submit" variant="secondary" size="primary">
                      {COPY.placeFixed}
                    </Button>
                  </form>
                ) : null}
                {placeFor === `${item.id}:flexible` ? (
                  <form
                    className="plan-fields"
                    onSubmit={(event) => {
                      event.preventDefault();
                      try {
                        mutate((current) => {
                          const placed = placeFlexible({
                            doc: current,
                            item,
                            blockId: crypto.randomUUID(),
                            durationMs: durationMin * 60_000,
                            precedingAnchorId:
                              anchorId.length > 0 ? anchorId : null,
                            chainPosition,
                            now: Date.now(),
                          }).doc;
                          return placed;
                        });
                        setPlaceFor(null);
                      } catch (error) {
                        setPartial((current) => ({
                          ...current,
                          [item.id]:
                            error instanceof Error
                              ? error.message
                              : COPY.partialFailure,
                        }));
                      }
                    }}
                  >
                    <label className="type-body-s">
                      {COPY.duration}
                      <input
                        type="number"
                        min={5}
                        value={durationMin}
                        onChange={(event) =>
                          setDurationMin(Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="type-body-s">
                      {COPY.precedingAnchor}
                      <select
                        value={anchorId}
                        onChange={(event) => setAnchorId(event.target.value)}
                      >
                        <option value="">{COPY.dayStart}</option>
                        {doc.plan.blocks.filter(isFixedBlock).map((block) => (
                          <option key={block.id} value={block.id}>
                            {block.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="type-body-s">
                      {COPY.chainPosition}
                      <input
                        type="number"
                        min={0}
                        value={chainPosition}
                        onChange={(event) =>
                          setChainPosition(Number(event.target.value))
                        }
                      />
                    </label>
                    <Button type="submit" variant="secondary" size="primary">
                      {COPY.placeFlexible}
                    </Button>
                  </form>
                ) : null}
                {partial[item.id] ? (
                  <p className="type-body-s">{partial[item.id]}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {doc && doc.step === 3 ? (
          <div
            className="plan-flourish"
            data-active={flourish ? "true" : "false"}
          >
            {issues.length === 0 ? (
              <p className="type-body-m">{COPY.reviewClean}</p>
            ) : (
              <ul>
                {issues.map((issue) => (
                  <li key={issue.label} className="type-body-m">
                    {issue.label}
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="secondary"
              size="primary"
              onClick={() =>
                mutate((current) => setStep(current, 2, Date.now()))
              }
            >
              {COPY.fixPlan}
            </Button>
            {needsKeepAnyway(doc) ? (
              <div className="plan-keep">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  onClick={() =>
                    mutate((current) => markKeepAnyway(current, Date.now()))
                  }
                >
                  {COPY.keepAnyway}
                </Button>
              </div>
            ) : null}
            {flourish ? (
              <Button
                type="button"
                variant="secondary"
                size="compact"
                onClick={() => setFlourish(false)}
              >
                {COPY.skipFlourish}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div data-primary-slot="plan-tomorrow">
          {primary ? (
            <Button
              type="button"
              variant="primary"
              size="primary"
              ornament="shell"
              onClick={primary.onClick}
            >
              {primary.label}
            </Button>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
