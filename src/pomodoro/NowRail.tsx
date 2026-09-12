import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  applyOverrunPush,
  packDay,
  type DayPlan,
  type MutationPreview,
} from "../calendar/index";
import type { WorkieDB } from "../db/schema";
import type { Task } from "../domain/types";
import { isLiveStatus } from "../domain/types";
import { remainingMs } from "../domain/remainingTime";
import { newId } from "../id";
import { Button } from "../ui/Button";
import { appDb } from "../shell/appDb";
import { OfflineIcon } from "../timeline/icons";
import {
  notifyBestEffort,
  playCueBestEffort,
  requestAlertPermission,
} from "./alerts";
import { COPY } from "./copy";
import {
  beginSwitch,
  budgetEndsAt,
  discardCycle,
  findUnfinished,
  loseObservation,
  offerBreak,
  pauseCycle,
  prepareContext,
  recoverRunningOnLoad,
  reconcile,
  remainingBudgetMs,
  resumeOnTask,
  resumePaused,
  shouldPushCalendar,
  skipBreak,
  startBreak,
  startCycle,
  stopEarly,
  tickBreak,
  tickRunning,
  warnFiveMinutes,
  type OfferedBreak,
} from "./engine";
import {
  SETTING_ALERTS,
  SETTING_SOUND,
  loadCycles,
  loadDefaultBudgetMs,
  loadFlag,
  persistCycle,
  saveDefaultBudgetMs,
  saveFlag,
} from "./persist";
import type {
  PomodoroCycle,
  PreparedContext,
  UnfinishedCycleState,
} from "./types";
import { DEFAULT_BUDGET_MS } from "./types";
import "./now.css";

export type NowRailProps = {
  now: number;
  tasks: readonly Task[];
  plan: DayPlan;
  db?: WorkieDB;
  offline?: boolean;
  onApplyCalendar?: (preview: MutationPreview) => void;
  onMarkRunning?: (blockId: string | null) => void;
  onProvisionalDiscard?: () => void;
  onUnfinishedState?: (state: UnfinishedCycleState | null) => void;
};

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

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function NowRail({
  now,
  tasks,
  plan,
  db = appDb,
  offline = false,
  onApplyCalendar,
  onMarkRunning,
  onProvisionalDiscard,
  onUnfinishedState,
}: NowRailProps) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorCause, setErrorCause] = useState<string | null>(null);
  const [cycles, setCycles] = useState<PomodoroCycle[]>([]);
  const [defaultBudgetMs, setDefaultBudgetMs] = useState(DEFAULT_BUDGET_MS);
  const [taskId, setTaskId] = useState("");
  const [blockId, setBlockId] = useState<string>("");
  const [sound, setSound] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [offeredBreak, setOfferedBreak] = useState<OfferedBreak>(skipBreak());
  const [flourish, setFlourish] = useState(false);
  const [saveLabel, setSaveLabel] = useState<string>(COPY.savedLocally);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
    () => true,
  );
  const live = tasks.filter((task) => isLiveStatus(task.status));
  const unfinished = findUnfinished(cycles);

  useEffect(() => {
    const state =
      unfinished && unfinished.state !== "ended" ? unfinished.state : null;
    onUnfinishedState?.(state);
  }, [unfinished, unfinished?.state, onUnfinishedState]);
  const packed = packDay(plan);
  const prepared: PreparedContext | null = taskId
    ? prepareContext({
        taskId,
        blockId: blockId.length > 0 ? blockId : null,
        defaultBudgetMs,
      })
    : null;

  const taskBlocks = useMemo(
    () =>
      packed.blocks.filter(
        (block) => block.kind === "task" && block.taskId === taskId,
      ),
    [packed.blocks, taskId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [loaded, budget, soundFlag, alertFlag] = await Promise.all([
          loadCycles(db),
          loadDefaultBudgetMs(db),
          loadFlag(db, SETTING_SOUND),
          loadFlag(db, SETTING_ALERTS),
        ]);
        if (cancelled) {
          return;
        }
        const recovered = loaded.map((cycle) =>
          recoverRunningOnLoad(cycle, Date.now()),
        );
        for (let i = 0; i < recovered.length; i += 1) {
          const next = recovered[i];
          const prev = loaded[i];
          if (next && prev && next.state !== prev.state) {
            await persistCycle(db, next);
          }
        }
        setCycles(recovered);
        setDefaultBudgetMs(budget);
        setSound(soundFlag);
        setAlerts(alertFlag);
        setLoadState("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setErrorCause(
            error instanceof Error ? error.message : COPY.saveError,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  async function save(cycle: PomodoroCycle): Promise<void> {
    try {
      await persistCycle(db, cycle);
      setCycles((current) => {
        const others = current.filter((item) => item.id !== cycle.id);
        return [...others, cycle].sort((a, b) => a.createdAt - b.createdAt);
      });
      setSaveLabel(COPY.savedLocally);
      setErrorCause(null);
    } catch (error) {
      setSaveLabel(COPY.savePending);
      setErrorCause(error instanceof Error ? error.message : COPY.saveError);
    }
  }

  useEffect(() => {
    if (!unfinished) {
      return;
    }
    if (unfinished.state === "running") {
      const ticked = tickRunning(unfinished, now);
      if (
        ticked.state !== unfinished.state ||
        ticked.outcome !== unfinished.outcome
      ) {
        void save(ticked);
        if (ticked.outcome === "Timer complete") {
          setOfferedBreak(offerBreak());
          setFlourish(!reducedMotion());
          playCueBestEffort(sound);
          if (alerts) {
            notifyBestEffort(COPY.timerComplete, COPY.mutedNote);
          }
        }
        return;
      }
      if (ticked.lastCertainAt !== unfinished.lastCertainAt) {
        void save(ticked);
      }
      const session = ticked.sessions.find(
        (item) => item.id === ticked.currentSessionId,
      );
      if (session && session.blockId) {
        const packedBlock = packed.blocks.find(
          (block) => block.id === session.blockId,
        );
        if (
          packedBlock &&
          shouldPushCalendar({
            session,
            blockEndMs: packedBlock.derivedEndMs,
            now,
          })
        ) {
          onApplyCalendar?.(applyOverrunPush(plan, now));
        }
      }
    }
    if (offeredBreak.running) {
      const next = tickBreak(offeredBreak, now);
      if (!next.running) {
        setOfferedBreak(next);
      }
    }
  }, [now, unfinished?.id, unfinished?.state, unfinished?.lastCertainAt]);

  useEffect(() => {
    function onHidden() {
      const current = findUnfinished(cycles);
      if (!current || current.state !== "running") {
        return;
      }
      if (document.visibilityState === "hidden") {
        void save(loseObservation(current, Date.now()));
      }
    }
    function onPageHide() {
      const current = findUnfinished(cycles);
      if (!current || current.state !== "running") {
        return;
      }
      void save(loseObservation(current, Date.now()));
    }
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [cycles, db]);

  async function handleStart() {
    if (!prepared) {
      return;
    }
    const result = startCycle(cycles, prepared, Date.now(), {
      cycleId: newId(),
      sessionId: newId(),
      segmentId: newId(),
    });
    if (!result.ok) {
      return;
    }
    await save(result.cycle);
    if (prepared.blockId) {
      onMarkRunning?.(prepared.blockId);
    }
  }

  const remaining = unfinished
    ? remainingBudgetMs(unfinished, now)
    : defaultBudgetMs;
  const endsAt = unfinished ? budgetEndsAt(unfinished) : null;
  const displayMs =
    unfinished?.state === "running" && endsAt !== null
      ? remainingMs(endsAt, now)
      : remaining;
  const currentSession = unfinished?.sessions.find(
    (item) => item.id === unfinished.currentSessionId,
  );
  const currentBlock = currentSession
    ? packed.blocks.find((block) => block.id === currentSession.blockId)
    : undefined;
  const fiveMin =
    currentSession && currentBlock
      ? warnFiveMinutes({
          session: currentSession,
          blockEndMs: currentBlock.derivedEndMs,
          now,
        })
      : false;

  const primary =
    loadState === "ready" && unfinished === undefined && prepared
      ? { label: COPY.start, onClick: () => void handleStart() }
      : unfinished?.state === "paused"
        ? {
            label: COPY.resume,
            onClick: () =>
              void save(
                resumePaused(unfinished, Date.now(), newId()),
              ),
          }
        : unfinished?.state === "running"
          ? {
              label: COPY.pause,
              onClick: () => void save(pauseCycle(unfinished, Date.now())),
            }
          : unfinished?.state === "awaiting task selection" && prepared
            ? {
                label: COPY.resume,
                onClick: () =>
                  void save(
                    resumeOnTask(unfinished, {
                      taskId: prepared.taskId,
                      blockId: prepared.blockId,
                      now: Date.now(),
                      ids: {
                        sessionId: newId(),
                        segmentId: newId(),
                      },
                    }),
                  ),
              }
            : null;

  return (
    <div className="now-rail" data-now-rail="true">
      {offline || !online ? (
        <div
          className="now-banner ui-ornament"
          data-ornament="dense"
          role="status"
          data-offline="true"
        >
          <div className="ui-ornament-content">
            <OfflineIcon />
            <p className="type-body-m">{COPY.offline}</p>
            <p className="type-body-s">{saveLabel}</p>
          </div>
        </div>
      ) : null}
      {loadState === "loading" ? (
        <div className="now-skeleton" aria-label={COPY.loading} />
      ) : null}
      {errorCause ? (
        <div className="now-banner ui-ornament" data-ornament="dense">
          <div className="ui-ornament-content">
            <p className="type-body-m">{errorCause}</p>
            <p className="type-body-s">{COPY.focusSafe}</p>
          </div>
        </div>
      ) : null}
      {unfinished === undefined && loadState === "ready" ? (
        <>
          <p className="type-body-m">{COPY.nothingRunning}</p>
          <p className="type-body-s">{COPY.prepareHint}</p>
          {live.length === 0 ? (
            <div>
              <div className="timeline-empty-motif" aria-hidden="true" />
              <p className="type-body-m">{COPY.emptyStep}</p>
            </div>
          ) : null}
        </>
      ) : null}
      {loadState === "ready" &&
      live.length > 0 &&
      (unfinished === undefined ||
        unfinished.state === "awaiting task selection") ? (
        <>
          <label className="type-body-s">
            {COPY.task}
            <select
              id="now-task"
              data-testid="now-task"
              value={taskId}
              onChange={(event) => {
                setTaskId(event.target.value);
                setBlockId("");
              }}
            >
              <option value=""> </option>
              {live.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label className="type-body-s">
            {COPY.block}
            <select
              value={blockId}
              onChange={(event) => setBlockId(event.target.value)}
            >
              <option value="">{COPY.unscheduled}</option>
              {taskBlocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.id}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {unfinished ? (
        <div className="now-flourish" data-active={flourish ? "true" : "false"}>
          <p className="type-timer now-timer" data-testid="pomodoro-timer">
            {formatRemaining(displayMs)}
          </p>
          <p className="type-body-s">
            {COPY.remaining} · {COPY.budget}{" "}
            {Math.round(unfinished.budgetMs / 60000)}m
          </p>
          <p className="type-body-s">{unfinished.state}</p>
          {unfinished.outcome ? (
            <p className="type-body-m">{unfinished.outcome}</p>
          ) : null}
          {unfinished.state === "awaiting reconciliation" ? (
            <div>
              <p className="type-body-m">{COPY.awaitingReconciliation}</p>
              <p className="type-body-s">{COPY.unreconciled}</p>
              <p className="type-body-s">
                {COPY.lastCertain}:{" "}
                {new Date(unfinished.lastCertainAt).toLocaleTimeString()}
              </p>
              <div className="now-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="primary"
                  onClick={() =>
                    void save(
                      reconcile(
                        unfinished,
                        "focus",
                        Date.now(),
                        newId(),
                      ).cycle,
                    )
                  }
                >
                  {COPY.countFocus}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="primary"
                  onClick={() =>
                    void save(
                      reconcile(
                        unfinished,
                        "pause",
                        Date.now(),
                        newId(),
                      ).cycle,
                    )
                  }
                >
                  {COPY.countPause}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="primary"
                  onClick={() => {
                    const result = reconcile(
                      unfinished,
                      "discard",
                      Date.now(),
                      newId(),
                    );
                    void save(result.cycle);
                    if (result.closeProvisionalDay) {
                      onProvisionalDiscard?.();
                    }
                  }}
                >
                  {COPY.confirmInterrupt}
                </Button>
              </div>
            </div>
          ) : null}
          {unfinished.state === "awaiting task selection" ? (
            <p className="type-body-s">{COPY.switchTask}</p>
          ) : null}
        </div>
      ) : null}
      {fiveMin ? (
        <p className="type-body-s" data-five-minute="rail">
          {COPY.fiveMinutes}
        </p>
      ) : null}
      <div data-primary-slot="daily-desk">
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
      {unfinished && unfinished.state !== "awaiting reconciliation" ? (
        <div className="now-actions">
          {unfinished.state === "running" || unfinished.state === "paused" ? (
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => void save(beginSwitch(unfinished, Date.now()))}
            >
              {COPY.switchTask}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => void save(stopEarly(unfinished, Date.now()))}
          >
            {COPY.stopEarly}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => {
              const result = discardCycle(unfinished, Date.now());
              void save(result.cycle);
              if (result.closeProvisionalDay) {
                onProvisionalDiscard?.();
              }
            }}
          >
            {COPY.discard}
          </Button>
        </div>
      ) : null}
      {offeredBreak.offered && findUnfinished(cycles) === undefined ? (
        <div className="now-actions">
          <p className="type-body-m">{COPY.offerBreak}</p>
          {offeredBreak.running ? (
            <p className="type-body-s">
              {COPY.breakRunning}{" "}
              {formatRemaining(
                remainingMs(
                  (offeredBreak.startedAt ?? now) + offeredBreak.durationMs,
                  now,
                ),
              )}
            </p>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={() => setOfferedBreak(startBreak(Date.now()))}
              >
                {COPY.startBreak}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={() => setOfferedBreak(skipBreak())}
              >
                {COPY.skipBreak}
              </Button>
            </>
          )}
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
      <label className="type-body-s">
        {COPY.defaultDuration}
        <input
          type="number"
          min={1}
          value={Math.round(defaultBudgetMs / 60000)}
          onChange={(event) => {
            const minutes = Number(event.target.value);
            if (!Number.isFinite(minutes) || minutes <= 0) {
              return;
            }
            const ms = minutes * 60_000;
            setDefaultBudgetMs(ms);
            void saveDefaultBudgetMs(db, ms, Date.now());
          }}
        />
      </label>
      <label className="type-body-s">
        <input
          type="checkbox"
          checked={sound}
          onChange={(event) => {
            const next = event.target.checked;
            setSound(next);
            void saveFlag(db, SETTING_SOUND, next, Date.now());
          }}
        />{" "}
        {COPY.soundOptIn}
      </label>
      <Button
        type="button"
        variant="secondary"
        size="primary"
        onClick={() => playCueBestEffort(true)}
      >
        {COPY.previewSound}
      </Button>
      <label className="type-body-s">
        <input
          type="checkbox"
          checked={alerts}
          onChange={(event) => {
            const next = event.target.checked;
            setAlerts(next);
            void saveFlag(db, SETTING_ALERTS, next, Date.now());
            if (next) {
              void requestAlertPermission();
            }
          }}
        />{" "}
        {COPY.alertsOptIn}
      </label>
      <p className="type-body-s">{COPY.mutedNote}</p>
      <p className="type-body-s">{saveLabel}</p>
    </div>
  );
}
