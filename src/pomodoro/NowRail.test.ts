import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import { COPY } from "./copy";
import {
  beginSwitch,
  loseObservation,
  pauseCycle,
  prepareContext,
  startCycle,
} from "./engine";
import { NowSessionDetails, showsSessionDetails } from "./NowRail";
import type { EngineIds, FocusSession, PomodoroCycle } from "./types";
import { DEFAULT_BUDGET_MS } from "./types";

const T0 = new Date(2026, 8, 14, 10, 0, 0, 0).getTime();
const TITLE = "café 日本語 ✓";
const BLOCK_ID = "block-a";
const DETAIL_STATES = ["running", "paused", "awaiting reconciliation"] as const;

const source = { kind: "user" as const, accountId: "local" };
const task = createTask({
  id: "task-a",
  title: TITLE,
  now: T0,
  source,
}).task;

function ids(n: number): EngineIds {
  return { cycleId: `c${n}`, sessionId: `s${n}`, segmentId: `g${n}` };
}

function startAt(blockId: string | null = BLOCK_ID): PomodoroCycle {
  const result = startCycle(
    [],
    prepareContext({
      taskId: task.id,
      blockId,
      defaultBudgetMs: DEFAULT_BUDGET_MS,
    }),
    T0,
    ids(1),
  );
  if (!result.ok) {
    throw new Error("expected start");
  }
  return result.cycle;
}

function currentSession(cycle: PomodoroCycle): FocusSession {
  const session = cycle.sessions.find(
    (item) => item.id === cycle.currentSessionId,
  );
  if (!session) {
    throw new Error("expected current session");
  }
  return session;
}

function renderDetails(session: FocusSession): string {
  return renderToStaticMarkup(
    createElement(NowSessionDetails, { session, tasks: [task] }),
  );
}

function cyclesForDetailStates(): PomodoroCycle[] {
  const running = startAt();
  return [
    running,
    pauseCycle(running, T0 + 1_000),
    loseObservation(running, T0 + 1_000),
  ];
}

const nowRailSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "NowRail.tsx"),
  "utf8",
);

describe("Now rail session details [D102]", () => {
  it("names the task title and block reference in Running, Paused, and Awaiting reconciliation", () => {
    const cycles = cyclesForDetailStates();
    expect(cycles.map((cycle) => cycle.state)).toEqual([...DETAIL_STATES]);
    for (const cycle of cycles) {
      expect(showsSessionDetails(cycle.state)).toBe(true);
      const html = renderDetails(currentSession(cycle));
      expect(html).toContain(`data-testid="now-session-task">${TITLE}<`);
      expect(html).toContain(`data-testid="now-session-block">${BLOCK_ID}<`);
      expect(html).toContain(COPY.task);
      expect(html).toContain(COPY.block);
    }
  });

  it("shows Unscheduled when the session has no block reference", () => {
    const html = renderDetails(currentSession(startAt(null)));
    expect(html).toContain(
      `data-testid="now-session-block">${COPY.unscheduled}<`,
    );
    expect(html).not.toContain("No block");
    expect(html).not.toContain("None");
  });

  it("does not change task status in Running, Paused, or Awaiting reconciliation", () => {
    expect(task.status).toBe("Waiting");
    for (const cycle of cyclesForDetailStates()) {
      renderDetails(currentSession(cycle));
      expect(task.status).toBe("Waiting");
    }
  });

  it("renders the task title verbatim in Unicode", () => {
    const html = renderDetails(currentSession(startAt()));
    expect(html).toContain(TITLE);
    expect(html).not.toContain("cafe");
    expect(html).not.toContain("Japanese");
  });

  it("keeps session details display-only", () => {
    const html = renderDetails(currentSession(startAt()));
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    const details = nowRailSource.slice(
      nowRailSource.indexOf("export function NowSessionDetails"),
      nowRailSource.indexOf("export type NowRailProps"),
    );
    expect(details).not.toMatch(/\bcomplete\b/);
    expect(details).not.toMatch(/moveLiveStatus/);
    expect(details).not.toMatch(/applyStatus/);
    expect(details).not.toMatch(/onMarkRunning/);
    expect(details).not.toMatch(/setTaskId/);
  });

  it("wires session details into Running, Paused, and Awaiting reconciliation only", () => {
    expect(nowRailSource).toContain(
      "showsSessionDetails(unfinished.state) && currentSession",
    );
    expect(nowRailSource).toContain(
      "<NowSessionDetails session={currentSession} tasks={tasks} />",
    );
    expect(showsSessionDetails("awaiting task selection")).toBe(false);
    expect(showsSessionDetails("ended")).toBe(false);
    const switching = beginSwitch(startAt(), T0 + 1_000);
    expect(switching.state).toBe("awaiting task selection");
    expect(showsSessionDetails(switching.state)).toBe(false);
    expect(switching.currentSessionId).toBeNull();
  });

  it("reuses Task, Calendar block, and Unscheduled copy", () => {
    const scheduled = renderDetails(currentSession(startAt()));
    const unscheduled = renderDetails(currentSession(startAt(null)));
    expect(scheduled).toContain(`>${COPY.task} `);
    expect(scheduled).toContain(`>${COPY.block} `);
    expect(unscheduled).toContain(COPY.unscheduled);
    expect(nowRailSource).toContain("COPY.task");
    expect(nowRailSource).toContain("COPY.block");
    expect(nowRailSource).toContain("COPY.unscheduled");
  });
});
