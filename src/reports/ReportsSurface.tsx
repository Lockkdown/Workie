import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { loadTaskState } from "../db/taskPersistence";
import { loadCycles } from "../pomodoro/persist";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { appDb } from "../shell/appDb";
import { OfflineIcon } from "../timeline/icons";
import { contributionCells } from "./contribution";
import { COPY } from "./copy";
import { filterOutcomeEvents, groupByDay, outcomeReport } from "./outcomes";
import {
  contributionYear,
  periodContaining,
  shiftPeriod,
  yearOf,
} from "./period";
import type { OutcomeStatus, PeriodKind } from "./types";
import { OUTCOME_STATUSES, PERIOD_KINDS } from "./types";
import { workingTimeReport } from "./workingTime";
import "./reports.css";

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

function formatMs(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return `${minutes}m`;
}

export function ReportsSurface() {
  const db = appDb;
  const [now] = useState(() => Date.now());
  const [kind, setKind] = useState<PeriodKind>("Week");
  const [period, setPeriod] = useState(() =>
    periodContaining("Week", Date.now()),
  );
  const [contribYearNum, setContribYearNum] = useState(() =>
    yearOf(Date.now()),
  );
  const [card, setCard] = useState<OutcomeStatus | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorCause, setErrorCause] = useState<string | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [cycles, setCycles] = useState<Awaited<ReturnType<typeof loadCycles>>>(
    [],
  );
  const [tasks, setTasks] = useState<
    Awaited<ReturnType<typeof loadTaskState>>["tasks"]
  >([]);
  const [occurrences, setOccurrences] = useState<
    Awaited<ReturnType<typeof loadTaskState>>["occurrences"]
  >([]);
  const [history, setHistory] = useState<
    Awaited<ReturnType<typeof loadTaskState>>["statusHistory"]
  >([]);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
    () => true,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadState("loading");
      const [cycleResult, taskResult] = await Promise.allSettled([
        loadCycles(db),
        loadTaskState(db),
      ]);
      if (cancelled) {
        return;
      }
      if (cycleResult.status === "fulfilled") {
        setCycles(cycleResult.value);
        setWorkError(null);
      } else {
        setWorkError(
          cycleResult.reason instanceof Error
            ? cycleResult.reason.message
            : "Could not load working time.",
        );
      }
      if (taskResult.status === "fulfilled") {
        setTasks(taskResult.value.tasks);
        setOccurrences(taskResult.value.occurrences);
        setHistory(taskResult.value.statusHistory);
        setOutcomeError(null);
      } else {
        setOutcomeError(
          taskResult.reason instanceof Error
            ? taskResult.reason.message
            : "Could not load task outcomes.",
        );
      }
      if (
        cycleResult.status === "rejected" &&
        taskResult.status === "rejected"
      ) {
        setLoadState("error");
        setErrorCause("Could not load reports.");
        return;
      }
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.id, task.title);
    }
    return map;
  }, [tasks]);

  const working = useMemo(
    () => workingTimeReport(cycles, period, titles),
    [cycles, period, titles],
  );
  const outcomes = useMemo(
    () => outcomeReport(history, tasks, period, occurrences),
    [history, tasks, period, occurrences],
  );
  const listed = filterOutcomeEvents(outcomes.events, card);
  const grouped = groupByDay(listed);
  const contrib = contributionCells(history, contributionYear(contribYearNum));
  const emptyWorking = loadState === "ready" && working.totalMs === 0;
  const maxBar = Math.max(1, ...working.bars.map((bar) => bar.ms));

  return (
    <div className="reports-surface">
      <Panel title={COPY.title} ornament="panel">
        {!online ? (
          <p
            className="offline-mark type-body-s"
            role="status"
            data-offline="true"
          >
            <OfflineIcon />
            <span>{COPY.offline}</span>
            <span>{COPY.savedLocally}</span>
          </p>
        ) : (
          <p className="type-body-s">{COPY.savedLocally}</p>
        )}
        {loadState === "loading" ? (
          <div className="reports-toolbar" aria-label={COPY.loading}>
            <div className="reports-skeleton" />
            <div className="reports-skeleton" />
          </div>
        ) : null}
        {errorCause ? (
          <div>
            <p className="type-body-m">{errorCause}</p>
            <p className="type-body-s">{COPY.errorKept}</p>
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
        <div
          className="reports-toolbar"
          role="radiogroup"
          aria-label={COPY.period}
        >
          {PERIOD_KINDS.map((item) => (
            <label key={item} className="type-body-s">
              <input
                type="radio"
                name="report-period"
                checked={kind === item}
                onChange={() => {
                  setKind(item);
                  setPeriod(periodContaining(item, now));
                }}
              />
              {item}
            </label>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => setPeriod((current) => shiftPeriod(current, -1))}
          >
            {COPY.previous}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => setPeriod((current) => shiftPeriod(current, 1))}
          >
            {COPY.next}
          </Button>
        </div>
      </Panel>
      <Panel title={COPY.workingTime} ornament="panel">
        {workError ? (
          <p className="reports-partial type-body-s">{workError}</p>
        ) : null}
        {emptyWorking ? (
          <div>
            <div className="timeline-empty-motif" aria-hidden="true" />
            <p className="type-body-m">{COPY.empty}</p>
          </div>
        ) : null}
        <p className="type-numeric">{formatMs(working.totalMs)}</p>
        <div
          className="reports-bars"
          role="img"
          aria-label={`${COPY.workingTime} ${formatMs(working.totalMs)}`}
        >
          {working.bars.map((bar) => (
            <div key={bar.key} className="reports-bar" title={bar.label}>
              <div
                className="reports-bar-fill"
                style={{ height: `${(bar.ms / maxBar) * 100}%` }}
              />
              <span className="type-numeric">{formatMs(bar.ms)}</span>
            </div>
          ))}
        </div>
        <h3 className="type-display-m">{COPY.timeByTask}</h3>
        <table className="reports-table type-numeric">
          <thead>
            <tr>
              <th>{COPY.identify}</th>
              <th>{COPY.workingTime}</th>
              <th>{COPY.share}</th>
            </tr>
          </thead>
          <tbody>
            {working.rows.map((row) => (
              <tr key={row.taskId}>
                <td>{row.title}</td>
                <td>{formatMs(row.ms)}</td>
                <td>{Math.round(row.share * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {working.discarded.length > 0 ? (
          <div>
            <h3 className="type-display-m">{COPY.discardedTrace}</h3>
            <ul>
              {working.discarded.map((item) => (
                <li key={item.cycleId} className="type-body-s">
                  {item.cycleId} · {item.workieDay}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>
      <Panel title={COPY.taskOutcomes} ornament="panel">
        {outcomeError ? (
          <p className="reports-partial type-body-s">{outcomeError}</p>
        ) : null}
        <p className="type-body-s">{COPY.countNote}</p>
        <div className="reports-cards">
          {OUTCOME_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              variant="secondary"
              size="primary"
              aria-pressed={card === status}
              onClick={() =>
                setCard((current) => (current === status ? null : status))
              }
            >
              {status}
              <span className="type-numeric"> {outcomes.counts[status]}</span>
            </Button>
          ))}
        </div>
        {grouped.length === 0 ? (
          <p className="type-body-m">{COPY.empty}</p>
        ) : (
          grouped.map((group) => (
            <section
              key={group.day}
              aria-label={`${COPY.dayGroup} ${group.day}`}
            >
              <h3 className="type-display-m">{group.day}</h3>
              <ul>
                {group.events.map((event) => (
                  <li key={event.id} className="type-body-m">
                    {event.title} · {event.status}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Panel>
      <Panel title={COPY.contribution} ornament="panel">
        <div className="reports-toolbar">
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => setContribYearNum((year) => year - 1)}
          >
            {COPY.previousYear}
          </Button>
          <span className="type-numeric">{contribYearNum}</span>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => setContribYearNum((year) => year + 1)}
          >
            {COPY.nextYear}
          </Button>
        </div>
        <div className="reports-legend" aria-label={COPY.legend}>
          {(["0", "1", "2", "3", "4+"] as const).map((level) => (
            <span key={level} className="type-body-s">
              <span
                className="reports-cell"
                data-level={level}
                aria-hidden="true"
              />{" "}
              {level}
            </span>
          ))}
        </div>
        <div className="reports-days" role="img" aria-label={COPY.contribution}>
          {contrib.map((cell) => (
            <span
              key={cell.day}
              className="reports-cell"
              data-level={cell.level}
              title={`${cell.day}: ${cell.count}`}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}
