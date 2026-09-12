import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDayPlan } from "../calendar/index";
import { WorkieDB } from "../db/schema";
import { createTask } from "../domain/taskModel";
import { atMostOneUnfinishedCycle } from "../domain/unfinishedCycle";
import { workieDayKey } from "../domain/workieDay";
import { COPY } from "./copy";
import { findUnfinished, unfinishedCount } from "./engine";
import { NowRail } from "./NowRail";
import { loadCycles } from "./persist";

type Mounted = { root: Root; container: HTMLElement };
const mounted: Mounted[] = [];
const opened: WorkieDB[] = [];

function mount(ui: ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  mounted.push({ root, container });
  return container;
}

function openDb(): WorkieDB {
  const db = new WorkieDB(`now-rail-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

function primaryButton(root: ParentNode): HTMLButtonElement | null {
  return root.querySelector('[data-primary-slot="daily-desk"] button');
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    act(() => {
      item.root.unmount();
    });
    item.container.remove();
  }
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

async function waitUntil(assert: () => void): Promise<void> {
  await vi.waitFor(
    async () => {
      await act(async () => {
        await Promise.resolve();
      });
      assert();
    },
    { timeout: 3_000 },
  );
}

describe("NowRail interaction [CURSOR-GOAL D.4 D.7 D.8]", () => {
  // Match handleStart/pause/resume, which stamp cycles with Date.now().
  const now = Date.now();
  const focus = createTask({
    id: "focus-task",
    title: "Write tests",
    now,
    source: { kind: "user", accountId: "local" },
  }).task;
  const other = createTask({
    id: "other-task",
    title: "Stay put",
    now,
    source: { kind: "user", accountId: "local" },
  }).task;
  const tasks = [focus, other];
  const plan = createDayPlan(workieDayKey(now));

  it("keeps Start unavailable until a task is chosen (invariant 4)", async () => {
    const db = openDb();
    const container = mount(createElement(NowRail, { now, tasks, plan, db }));
    await waitUntil(() => {
      expect(container.querySelector("#now-task")).toBeInstanceOf(
        HTMLSelectElement,
      );
    });
    expect(primaryButton(container)).toBeNull();
    expect(unfinishedCount(await loadCycles(db))).toBe(0);
    expect(
      atMostOneUnfinishedCycle(unfinishedCount(await loadCycles(db))),
    ).toBe(true);
    expect(focus.status).toBe("Waiting");
    expect(other.status).toBe("Waiting");
  });

  it("Start then Pause then Resume is one unfinished cycle and never changes task status (invariants 4, 7, 8)", async () => {
    const db = openDb();
    const statusBefore = {
      focus: focus.status,
      other: other.status,
    };
    const container = mount(createElement(NowRail, { now, tasks, plan, db }));
    await waitUntil(() => {
      expect(container.querySelector("#now-task")).toBeInstanceOf(
        HTMLSelectElement,
      );
    });

    // Invariant 4: nothing is recorded and Start is unavailable until a task is chosen.
    expect(primaryButton(container)).toBeNull();
    expect(unfinishedCount(await loadCycles(db))).toBe(0);

    const picker = container.querySelector("#now-task");
    expect(picker).toBeInstanceOf(HTMLSelectElement);
    setSelectValue(picker as HTMLSelectElement, focus.id);
    expect(primaryButton(container)?.textContent?.trim()).toBe(COPY.start);

    await act(async () => {
      primaryButton(container)?.click();
    });
    await waitUntil(() => {
      expect(primaryButton(container)?.textContent?.trim()).toBe(COPY.pause);
    });

    await act(async () => {
      primaryButton(container)?.click();
    });
    await waitUntil(() => {
      expect(primaryButton(container)?.textContent?.trim()).toBe(COPY.resume);
    });

    await act(async () => {
      primaryButton(container)?.click();
    });
    await waitUntil(() => {
      expect(primaryButton(container)?.textContent?.trim()).toBe(COPY.pause);
    });

    const cycles = await loadCycles(db);
    const unfinished = findUnfinished(cycles);

    // Invariant 8: at most one unfinished cycle exists.
    expect(atMostOneUnfinishedCycle(unfinishedCount(cycles))).toBe(true);
    expect(unfinishedCount(cycles)).toBe(1);
    expect(unfinished?.state).toBe("running");
    expect(unfinished?.outcome).toBeNull();
    expect(cycles.filter((cycle) => cycle.state !== "ended")).toHaveLength(1);

    // Invariant 7: no cycle action changes task status.
    expect(focus.status).toBe(statusBefore.focus);
    expect(other.status).toBe(statusBefore.other);
    expect(focus.status).toBe("Waiting");
    expect(other.status).toBe("Waiting");
    expect(
      unfinished?.sessions.every((session) => session.taskId === focus.id),
    ).toBe(true);
  });
});
