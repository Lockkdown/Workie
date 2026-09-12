import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createTask } from "../domain/taskModel";
import {
  abandon,
  cancel,
  complete,
  moveLiveStatus,
  restore,
} from "../domain/transitions";
import type { LiveStatus, StatusHistoryEvent, Task } from "../domain/types";
import type { BoardCardHandlers } from "./BoardCard";
import { applyMoveToLive, selectBoardItems } from "./boardModel";
import { COPY } from "./copy";
import { noopBoardHandlers, TaskBoardView } from "./TaskBoardView";

type Mounted = { root: Root; container: HTMLElement };
const mounted: Mounted[] = [];

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

afterEach(() => {
  for (const item of mounted.splice(0)) {
    act(() => {
      item.root.unmount();
    });
    item.container.remove();
  }
});

const source = { kind: "user" as const, accountId: "local" };
const NOW = 1_700_000_000_000;

function liveTask(id: string, title: string, status: LiveStatus): Task {
  const created = createTask({ id, title, now: 1, source }).task;
  if (status === "Waiting") {
    return created;
  }
  return moveLiveStatus(created, status, 2, []).entity;
}

function closedTask(
  id: string,
  title: string,
  close: "complete" | "abandon" | "cancel",
): Task {
  const created = createTask({ id, title, now: 1, source }).task;
  if (close === "complete") {
    return complete(created, 2, []).entity;
  }
  if (close === "abandon") {
    return abandon(created, { confirmed: true }, 2, []).entity;
  }
  return cancel(created, { confirmed: true }, 2, []).entity;
}

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (button) => button.textContent?.replace(/\s+/g, " ").trim() === name,
  );
  if (found === undefined) {
    throw new Error(`No button named ${name}`);
  }
  return found;
}

function card(root: ParentNode, entityId: string): HTMLElement {
  const node = root.querySelector(`[data-entity-id="${entityId}"]`);
  if (!(node instanceof HTMLElement)) {
    throw new Error(`No card ${entityId}`);
  }
  return node;
}

function idsIn(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(`${selector} [data-entity-id]`)]
    .map((node) => node.getAttribute("data-entity-id"))
    .filter((id): id is string => id !== null);
}

function statusesById(tasks: readonly Task[]): Record<string, Task["status"]> {
  return Object.fromEntries(tasks.map((task) => [task.id, task.status]));
}

function InteractiveBoard({
  initial,
  onTasks,
}: {
  initial: readonly Task[];
  onTasks: (tasks: Task[]) => void;
}): ReactElement {
  const [tasks, setTasks] = useState<Task[]>(() => [...initial]);
  const [history, setHistory] = useState<StatusHistoryEvent[]>([]);
  const [confirming, setConfirming] = useState<{
    entityId: string;
    action: "abandon" | "cancel";
  } | null>(null);
  onTasks(tasks);

  function commit(entity: Task, nextHistory: StatusHistoryEvent[]): void {
    setTasks((current) =>
      current.map((task) => (task.id === entity.id ? entity : task)),
    );
    setHistory(nextHistory);
  }

  const handlers: BoardCardHandlers = {
    ...noopBoardHandlers(),
    onComplete: (entityId) => {
      const task = tasks.find((item) => item.id === entityId);
      if (task === undefined) {
        return;
      }
      const result = complete(task, Date.now(), history);
      commit(result.entity, result.history);
    },
    onRestore: (entityId) => {
      const task = tasks.find((item) => item.id === entityId);
      if (task === undefined) {
        return;
      }
      const result = restore(task, Date.now(), history);
      commit(result.entity, result.history);
    },
    onRequestAbandon: (entityId) => {
      setConfirming({ entityId, action: "abandon" });
    },
    onRequestCancel: (entityId) => {
      setConfirming({ entityId, action: "cancel" });
    },
    onConfirmClose: () => {
      if (confirming === null) {
        return;
      }
      const task = tasks.find((item) => item.id === confirming.entityId);
      if (task === undefined) {
        return;
      }
      const result =
        confirming.action === "abandon"
          ? abandon(task, { confirmed: true }, Date.now(), history)
          : cancel(task, { confirmed: true }, Date.now(), history);
      commit(result.entity, result.history);
      setConfirming(null);
    },
    onDismissConfirm: () => {
      setConfirming(null);
    },
    onMoveTo: (entityId, status) => {
      const moved = applyMoveToLive({
        items: selectBoardItems(tasks, [], NOW),
        history,
        entityId,
        to: status,
        now: Date.now(),
      });
      if ("intent" in moved) {
        return;
      }
      setTasks(
        moved.items.flatMap((item) =>
          item.entity.kind === "task" ? [item.entity] : [],
        ),
      );
      setHistory(moved.history);
    },
  };

  return createElement(TaskBoardView, {
    tasks,
    occurrences: [],
    statusHistory: history,
    blocks: [],
    now: NOW,
    online: true,
    loading: false,
    formOpen: false,
    detailEntityId: null,
    confirming,
    partialFailures: {},
    onClose: () => undefined,
    onOpenForm: () => undefined,
    onCloseForm: () => undefined,
    onCloseDetail: () => undefined,
    onCreated: () => undefined,
    handlers,
  });
}

const LIVE_MOVES: { from: LiveStatus; to: LiveStatus; label: string }[] = [
  { from: "Waiting", to: "In Progress", label: COPY.moveToInProgress },
  { from: "Waiting", to: "Deferred", label: COPY.moveToDeferred },
  { from: "In Progress", to: "Waiting", label: COPY.moveToWaiting },
  { from: "In Progress", to: "Deferred", label: COPY.moveToDeferred },
  { from: "Deferred", to: "Waiting", label: COPY.moveToWaiting },
  { from: "Deferred", to: "In Progress", label: COPY.moveToInProgress },
];

describe("TaskBoard interaction", () => {
  it.each(LIVE_MOVES)(
    "moves the actor with $label and leaves every other task untouched",
    ({ from, to, label }) => {
      const actor = liveTask("actor", "Actor", from);
      const keepers = [
        liveTask("keep-waiting", "Keep waiting", "Waiting"),
        liveTask("keep-progress", "Keep progress", "In Progress"),
        liveTask("keep-deferred", "Keep deferred", "Deferred"),
        closedTask("keep-closed", "Keep closed", "complete"),
      ];
      let latest: Task[] = [];
      const container = mount(
        createElement(InteractiveBoard, {
          initial: [actor, ...keepers],
          onTasks: (tasks) => {
            latest = tasks;
          },
        }),
      );
      const beforeOthers = statusesById(keepers);
      act(() => {
        buttonNamed(card(container, "actor"), label).click();
      });
      expect(idsIn(container, `[data-column="${to}"]`)).toContain("actor");
      if (to !== "Waiting") {
        expect(idsIn(container, '[data-column="Waiting"]')).not.toContain(
          "actor",
        );
      }
      expect(latest.find((task) => task.id === "actor")?.status).toBe(to);
      const others = latest.filter((task) => task.id !== "actor");
      expect(statusesById(others)).toEqual(beforeOthers);
      expect(idsIn(container, '[data-column="Waiting"]')).toContain(
        "keep-waiting",
      );
      expect(idsIn(container, '[data-column="In Progress"]')).toContain(
        "keep-progress",
      );
      expect(idsIn(container, '[data-column="Deferred"]')).toContain(
        "keep-deferred",
      );
      expect(idsIn(container, '[data-subgroup="Completed"]')).toEqual([
        "keep-closed",
      ]);
    },
  );

  it("completes from the card menu into Closed / Completed", () => {
    const actor = liveTask("actor", "Actor", "Waiting");
    const keepers = [
      liveTask("keep-waiting", "Keep waiting", "Waiting"),
      liveTask("keep-progress", "Keep progress", "In Progress"),
    ];
    let latest: Task[] = [];
    const container = mount(
      createElement(InteractiveBoard, {
        initial: [actor, ...keepers],
        onTasks: (tasks) => {
          latest = tasks;
        },
      }),
    );
    const beforeOthers = statusesById(keepers);
    act(() => {
      buttonNamed(card(container, "actor"), COPY.complete).click();
    });
    expect(idsIn(container, '[data-subgroup="Completed"]')).toEqual(["actor"]);
    expect(latest.find((task) => task.id === "actor")?.status).toBe(
      "Completed",
    );
    expect(statusesById(latest.filter((task) => task.id !== "actor"))).toEqual(
      beforeOthers,
    );
  });

  it("abandons from the card menu into Closed / Abandoned", () => {
    const actor = liveTask("actor", "Actor", "In Progress");
    const keepers = [
      liveTask("keep-waiting", "Keep waiting", "Waiting"),
      liveTask("keep-progress", "Keep progress", "In Progress"),
    ];
    let latest: Task[] = [];
    const container = mount(
      createElement(InteractiveBoard, {
        initial: [actor, ...keepers],
        onTasks: (tasks) => {
          latest = tasks;
        },
      }),
    );
    const beforeOthers = statusesById(keepers);
    act(() => {
      buttonNamed(card(container, "actor"), COPY.abandon).click();
    });
    act(() => {
      buttonNamed(card(container, "actor"), COPY.confirmAbandon).click();
    });
    expect(idsIn(container, '[data-subgroup="Abandoned"]')).toEqual(["actor"]);
    expect(latest.find((task) => task.id === "actor")?.status).toBe(
      "Abandoned",
    );
    expect(statusesById(latest.filter((task) => task.id !== "actor"))).toEqual(
      beforeOthers,
    );
  });

  it("cancels from the card menu into Closed / Cancelled", () => {
    const actor = liveTask("actor", "Actor", "Deferred");
    const keepers = [
      liveTask("keep-waiting", "Keep waiting", "Waiting"),
      liveTask("keep-deferred", "Keep deferred", "Deferred"),
    ];
    let latest: Task[] = [];
    const container = mount(
      createElement(InteractiveBoard, {
        initial: [actor, ...keepers],
        onTasks: (tasks) => {
          latest = tasks;
        },
      }),
    );
    const beforeOthers = statusesById(keepers);
    act(() => {
      buttonNamed(card(container, "actor"), COPY.cancel).click();
    });
    act(() => {
      buttonNamed(card(container, "actor"), COPY.confirmCancel).click();
    });
    expect(idsIn(container, '[data-subgroup="Cancelled"]')).toEqual(["actor"]);
    expect(latest.find((task) => task.id === "actor")?.status).toBe(
      "Cancelled",
    );
    expect(statusesById(latest.filter((task) => task.id !== "actor"))).toEqual(
      beforeOthers,
    );
  });

  it("restores a closed card back to Waiting without touching others", () => {
    const actor = closedTask("actor", "Actor", "complete");
    const keepers = [
      liveTask("keep-waiting", "Keep waiting", "Waiting"),
      closedTask("keep-abandoned", "Keep abandoned", "abandon"),
    ];
    let latest: Task[] = [];
    const container = mount(
      createElement(InteractiveBoard, {
        initial: [actor, ...keepers],
        onTasks: (tasks) => {
          latest = tasks;
        },
      }),
    );
    const beforeOthers = statusesById(keepers);
    act(() => {
      buttonNamed(card(container, "actor"), COPY.restore).click();
    });
    expect(idsIn(container, '[data-column="Waiting"]')).toContain("actor");
    expect(latest.find((task) => task.id === "actor")?.status).toBe("Waiting");
    expect(statusesById(latest.filter((task) => task.id !== "actor"))).toEqual(
      beforeOthers,
    );
  });
});
