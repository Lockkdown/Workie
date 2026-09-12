import type { DayPlan } from "../calendar/index";

export const TRAY_GROUPS = [
  "Unfinished today",
  "Repeating tomorrow",
  "Live tasks",
] as const;

export type TrayGroupName = (typeof TRAY_GROUPS)[number];

export type TrayItem = {
  id: string;
  entityKind: "task" | "occurrence";
  taskId: string;
  title: string;
  date: string | null;
  status: "Waiting" | "In Progress" | "Deferred";
  liveOrder: number;
  group: TrayGroupName;
  reason: string;
};

export type TrayGroups = Record<TrayGroupName, TrayItem[]>;

export type PlanRevision = {
  id: string;
  at: number;
};

export type BlockOwner = {
  blockId: string;
  entityId: string;
};

export type PlanningDocument = {
  day: string;
  commitState: "draft" | "committed";
  step: 1 | 2 | 3;
  selectedIds: string[];
  keepAnyway: boolean;
  plan: DayPlan;
  owners: BlockOwner[];
  revisions: PlanRevision[];
  createdAt: number;
  updatedAt: number;
};
