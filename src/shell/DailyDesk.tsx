import { useEffect, useState, useSyncExternalStore } from "react";
import {
  type DayPlan,
  type MutationPreview,
  createDayPlan,
  packDay,
  setRunningBlock,
  warnBeforeEndOfRunning,
} from "../calendar/index";
import {
  loadTaskState,
  persistBackfillMissedOccurrences,
} from "../db/taskPersistence";
import type { WorkieDB } from "../db/schema";
import type { Task } from "../domain/types";
import { workieDayKey } from "../domain/workieDay";
import { TaskBoard } from "../tasks/TaskBoard";
import { Button } from "../ui/Button";
import { DESK_MODES, type DeskMode } from "./destinations";
import { appDb } from "./appDb";
import { COPY } from "../timeline/copy";
import { persistDayPlan, loadDayPlan } from "../timeline/persist";
import {
  openScheduleDraftForReserve,
  openScheduleDraftForTask,
  TimelineSurface,
} from "../timeline/TimelineSurface";
import type { ScheduleDraft } from "../timeline/schedule";
import { TaskTrayList } from "../timeline/TaskTrayList";
import "../timeline/timeline.css";

type DailyDeskProps = {
  mode: DeskMode;
  trayCollapsed: boolean;
  onMode: (mode: DeskMode) => void;
  onTrayCollapsed: (collapsed: boolean) => void;
  db?: WorkieDB;
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

function onlineSnapshot(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

export function DailyDesk({
  mode,
  trayCollapsed,
  onMode,
  onTrayCollapsed,
  db = appDb,
}: DailyDeskProps) {
  const [now, setNow] = useState(() => Date.now());
  const [plan, setPlan] = useState<DayPlan>(() =>
    createDayPlan(workieDayKey(Date.now())),
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorCause, setErrorCause] = useState<string | null>(null);
  const [preview, setPreview] = useState<MutationPreview | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [seedDraft, setSeedDraft] = useState<ScheduleDraft | null>(null);
  const [saveLabel, setSaveLabel] = useState<string>(COPY.savedLocally);
  const [partialFailures, setPartialFailures] = useState<
    Record<string, string>
  >({});
  const [reload, setReload] = useState(0);
  const online = useSyncExternalStore(
    subscribeOnline,
    onlineSnapshot,
    () => true,
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const day = workieDayKey(Date.now());
    void (async () => {
      try {
        const lastOpenRow = await db.settings.get("lastOpen");
        const lastOpenMs = Number(lastOpenRow?.value);
        const nowMs = Date.now();
        await persistBackfillMissedOccurrences(
          db,
          nowMs,
          Number.isFinite(lastOpenMs) ? lastOpenMs : nowMs,
        );
        await db.settings.put({
          id: "lastOpen",
          value: String(nowMs),
          createdAt: lastOpenRow?.createdAt ?? nowMs,
          updatedAt: nowMs,
        });
        const [taskState, dayPlan] = await Promise.all([
          loadTaskState(db),
          loadDayPlan(db, day),
        ]);
        if (cancelled) {
          return;
        }
        setTasks(taskState.tasks);
        setPlan(dayPlan);
        setLoadState("ready");
        setErrorCause(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadState("error");
        setErrorCause(
          error instanceof Error
            ? error.message
            : "Could not load the day plan.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, reload]);

  async function applyPreview(nextPreview: MutationPreview) {
    const previous = plan;
    setPlan(nextPreview.next);
    setPreview(null);
    try {
      await persistDayPlan(db, previous, nextPreview.next, Date.now());
      const taskState = await loadTaskState(db);
      setTasks(taskState.tasks);
      setSaveLabel(COPY.savedLocally);
      setPartialFailures({});
    } catch (error) {
      setPlan(previous);
      setSaveLabel(COPY.savePending);
      setErrorCause(error instanceof Error ? error.message : "Save failed.");
    }
  }

  async function markRunning(blockId: string | null) {
    const previous = plan;
    const next = setRunningBlock(plan, blockId);
    setPlan(next);
    try {
      await persistDayPlan(db, previous, next, Date.now());
      setSaveLabel(COPY.savedLocally);
    } catch (error) {
      setPlan(previous);
      setErrorCause(error instanceof Error ? error.message : "Save failed.");
    }
  }

  const packed = packDay(plan);
  const fiveMin = warnBeforeEndOfRunning(plan, now);

  return (
    <section className="daily-desk" aria-labelledby="daily-desk-title">
      <header className="daily-desk-header">
        <h2 id="daily-desk-title" className="type-display-xl">
          Daily Desk
        </h2>
        <p className="type-body-l" data-testid="user-content">
          Việc cần làm
        </p>
      </header>
      <div
        className="desk-modes"
        role="radiogroup"
        aria-label="Daily Desk mode"
      >
        {DESK_MODES.map((name) => (
          <button
            key={name}
            type="button"
            className="desk-mode type-display-m"
            role="radio"
            aria-checked={mode === name}
            onClick={() => onMode(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="desk-workspace" data-mode={mode}>
        <section
          className="desk-zone ui-ornament"
          data-ornament="panel"
          data-zone="tray"
          data-collapsed={trayCollapsed ? "true" : "false"}
          aria-label="Tasks"
        >
          <div className="ui-ornament-content">
            <div className="desk-zone-toolbar">
              <h3 className="type-display-m">Tasks</h3>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                ornament="dense"
                aria-expanded={!trayCollapsed}
                onClick={() => onTrayCollapsed(!trayCollapsed)}
              >
                {trayCollapsed ? "Expand tray" : "Collapse tray"}
              </Button>
            </div>
            <div className="desk-zone-body">
              <TaskTrayList
                tasks={tasks}
                packed={packed}
                onOpenBoard={() => setBoardOpen(true)}
                onCreateReserve={() =>
                  setSeedDraft(openScheduleDraftForReserve(plan))
                }
                onScheduleTask={(taskId) =>
                  setSeedDraft(openScheduleDraftForTask(plan, taskId))
                }
              />
            </div>
          </div>
        </section>
        <section
          className="desk-zone desk-timeline ui-ornament"
          data-ornament="panel"
          data-zone="timeline"
          aria-label="Day"
        >
          <div className="ui-ornament-content">
            <h3 className="type-display-m">Day</h3>
            <TimelineSurface
              plan={plan}
              tasks={tasks}
              now={now}
              loadState={loadState}
              errorCause={errorCause}
              offline={!online}
              saveLabel={saveLabel}
              preview={preview}
              partialFailures={partialFailures}
              seedDraft={seedDraft}
              onPropose={setPreview}
              onApply={(next) => {
                void applyPreview(next);
              }}
              onCancel={() => setPreview(null)}
              onRetry={() => setReload((value) => value + 1)}
              onMarkRunning={(blockId) => {
                void markRunning(blockId);
              }}
            />
          </div>
        </section>
        <section
          className="desk-zone ui-ornament"
          data-ornament="panel"
          data-zone="now"
          aria-label="Now"
        >
          <div className="ui-ornament-content">
            <h3 className="type-display-m">Now</h3>
            {plan.runningBlockId === null ? (
              <p className="type-body-m">Nothing running.</p>
            ) : null}
            <div data-primary-slot="daily-desk" />
            {fiveMin ? (
              <p className="type-body-s" data-five-minute="rail">
                {COPY.fiveMinutes}
              </p>
            ) : null}
          </div>
        </section>
      </div>
      <TaskBoard
        open={boardOpen}
        onClose={() => {
          setBoardOpen(false);
          setReload((value) => value + 1);
        }}
        onScheduleTask={(taskId) => {
          setBoardOpen(false);
          setReload((value) => value + 1);
          setSeedDraft(openScheduleDraftForTask(plan, taskId));
        }}
      />
    </section>
  );
}
