import type { DayPlan } from "../calendar/index";
import { isTaskBlock } from "../calendar/index";
import { isLiveStatus, type Occurrence, type Task } from "../domain/types";
import { tomorrowWorkieDay, workieDayKey } from "../domain/workieDay";
import { TRAY_GROUPS, type TrayGroups, type TrayItem } from "./types";

const LIVE_ORDER = ["Waiting", "In Progress", "Deferred"] as const;

function liveOrderOf(entity: {
  liveOrder?: number;
  createdAt: number;
  id: string;
}): {
  liveOrder: number;
  id: string;
} {
  return { liveOrder: entity.liveOrder ?? entity.createdAt, id: entity.id };
}

function sortKanban(items: TrayItem[]): TrayItem[] {
  return [...items].sort((a, b) => {
    const ac = LIVE_ORDER.indexOf(a.status);
    const bc = LIVE_ORDER.indexOf(b.status);
    if (ac !== bc) {
      return ac - bc;
    }
    if (a.liveOrder !== b.liveOrder) {
      return a.liveOrder - b.liveOrder;
    }
    return a.id.localeCompare(b.id);
  });
}

function repeating(task: Task): boolean {
  return (task.repeatWeekdays?.length ?? 0) > 0;
}

export function buildTray(input: {
  now: number;
  tasks: readonly Task[];
  occurrences: readonly Occurrence[];
  todayPlan: DayPlan;
  carryOverIds?: readonly string[];
}): TrayGroups {
  const today = workieDayKey(input.now);
  const tomorrow = tomorrowWorkieDay(input.now);
  const carry = new Set(input.carryOverIds ?? []);
  const onToday = new Set(
    input.todayPlan.blocks.filter(isTaskBlock).map((block) => block.taskId),
  );
  const byId = new Map(input.tasks.map((task) => [task.id, task]));
  const unfinished: TrayItem[] = [];
  const repeatingTomorrow: TrayItem[] = [];
  const used = new Set<string>();

  function push(item: TrayItem, bucket: TrayItem[]) {
    if (used.has(item.id)) {
      return;
    }
    used.add(item.id);
    bucket.push(item);
  }

  for (const occurrence of input.occurrences) {
    if (!isLiveStatus(occurrence.status) || occurrence.status === "Deferred") {
      continue;
    }
    const parent = byId.get(occurrence.taskId);
    if (!parent) {
      continue;
    }
    const order = liveOrderOf(occurrence);
    if (occurrence.date < tomorrow) {
      push(
        {
          id: occurrence.id,
          entityKind: "occurrence",
          taskId: parent.id,
          title: parent.title,
          date: occurrence.date,
          status: occurrence.status,
          liveOrder: order.liveOrder,
          group: "Unfinished today",
          reason:
            occurrence.date < today
              ? `Missed occurrence on ${occurrence.date}`
              : "Unfinished from today",
        },
        unfinished,
      );
    }
  }

  for (const task of input.tasks) {
    if (!isLiveStatus(task.status) || task.status === "Deferred") {
      continue;
    }
    const onPlan = onToday.has(task.id);
    const carried = carry.has(task.id);
    if (!onPlan && !carried) {
      continue;
    }
    if (repeating(task) && !onPlan && !carried) {
      continue;
    }
    const order = liveOrderOf(task);
    push(
      {
        id: task.id,
        entityKind: "task",
        taskId: task.id,
        title: task.title,
        date: null,
        status: task.status,
        liveOrder: order.liveOrder,
        group: "Unfinished today",
        reason: carried
          ? "Carried from a previous day"
          : "Unfinished from today",
      },
      unfinished,
    );
  }

  for (const occurrence of input.occurrences) {
    if (!isLiveStatus(occurrence.status) || occurrence.date !== tomorrow) {
      continue;
    }
    const parent = byId.get(occurrence.taskId);
    if (!parent) {
      continue;
    }
    const order = liveOrderOf(occurrence);
    push(
      {
        id: occurrence.id,
        entityKind: "occurrence",
        taskId: parent.id,
        title: parent.title,
        date: occurrence.date,
        status:
          occurrence.status === "Deferred" ? "Deferred" : occurrence.status,
        liveOrder: order.liveOrder,
        group: "Repeating tomorrow",
        reason: `Repeats on ${occurrence.date}`,
      },
      repeatingTomorrow,
    );
  }

  const live: TrayItem[] = [];
  for (const task of input.tasks) {
    if (!isLiveStatus(task.status) || used.has(task.id)) {
      continue;
    }
    if (repeating(task)) {
      const hasOcc = input.occurrences.some(
        (item) => item.taskId === task.id && used.has(item.id),
      );
      if (hasOcc && task.status !== "Deferred") {
        continue;
      }
    }
    const order = liveOrderOf(task);
    live.push({
      id: task.id,
      entityKind: "task",
      taskId: task.id,
      title: task.title,
      date: null,
      status: task.status,
      liveOrder: order.liveOrder,
      group: "Live tasks",
      reason:
        task.status === "Deferred"
          ? "Deferred — still live, not auto-promoted"
          : "Live task",
    });
  }
  for (const occurrence of input.occurrences) {
    if (!isLiveStatus(occurrence.status) || used.has(occurrence.id)) {
      continue;
    }
    const parent = byId.get(occurrence.taskId);
    if (!parent) {
      continue;
    }
    const order = liveOrderOf(occurrence);
    live.push({
      id: occurrence.id,
      entityKind: "occurrence",
      taskId: parent.id,
      title: parent.title,
      date: occurrence.date,
      status: occurrence.status,
      liveOrder: order.liveOrder,
      group: "Live tasks",
      reason:
        occurrence.status === "Deferred"
          ? "Deferred — still live, not auto-promoted"
          : "Live task",
    });
  }

  return {
    "Unfinished today": sortKanban(unfinished),
    "Repeating tomorrow": sortKanban(repeatingTomorrow),
    "Live tasks": sortKanban(live),
  };
}

export function trayGroupOrder(): typeof TRAY_GROUPS {
  return TRAY_GROUPS;
}

export function flattenTray(groups: TrayGroups): TrayItem[] {
  return TRAY_GROUPS.flatMap((name) => groups[name]);
}
