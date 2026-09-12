import { type DayPlan, createDayPlan } from "../calendar/index";
import type { PlanningDraftRecord, WorkieDB } from "../db/schema";
import { persistDayPlan, loadDayPlan } from "../timeline/persist";
import type { BlockOwner, PlanRevision, PlanningDocument } from "./types";

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function draftFromRecord(
  row: PlanningDraftRecord,
  fallbackDay: string,
): PlanningDocument {
  const plan = parseJson<DayPlan | null>(row.planJson, null);
  return {
    day: row.day ?? fallbackDay,
    commitState: row.commitState === "committed" ? "committed" : "draft",
    step: row.step === 2 || row.step === 3 ? row.step : 1,
    selectedIds: parseJson<string[]>(row.selectedJson, []),
    keepAnyway: row.keepAnyway === 1,
    plan: plan ?? createDayPlan(row.day ?? fallbackDay),
    owners: parseJson<BlockOwner[]>(row.ownersJson, []),
    revisions: parseJson<PlanRevision[]>(row.revisionsJson, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function loadPlanningDocument(
  db: WorkieDB,
  day: string,
): Promise<PlanningDocument | null> {
  const row = await db.planningDrafts.get(day);
  if (!row) {
    return null;
  }
  return draftFromRecord(row, day);
}

export async function savePlanningDocument(
  db: WorkieDB,
  doc: PlanningDocument,
): Promise<void> {
  const existing = await db.planningDrafts.get(doc.day);
  await db.planningDrafts.put({
    id: doc.day,
    createdAt: existing?.createdAt ?? doc.createdAt,
    updatedAt: doc.updatedAt,
    day: doc.day,
    commitState: doc.commitState,
    step: doc.step,
    selectedJson: JSON.stringify(doc.selectedIds),
    keepAnyway: doc.keepAnyway ? 1 : 0,
    planJson: JSON.stringify(doc.plan),
    ownersJson: JSON.stringify(doc.owners),
    revisionsJson: JSON.stringify(doc.revisions),
  });
}

export async function commitPlanToCalendar(
  db: WorkieDB,
  previous: DayPlan,
  next: DayPlan,
  now: number,
): Promise<void> {
  await persistDayPlan(db, previous, next, now);
}

export async function loadCommittedOrEmpty(
  db: WorkieDB,
  day: string,
): Promise<DayPlan> {
  return loadDayPlan(db, day);
}

export const CARRY_PREFIX = "carryOver:";
export const DAY_CLOSE_ASKED_PREFIX = "dayCloseAsked:";

export function carryOverSettingId(day: string): string {
  return `${CARRY_PREFIX}${day}`;
}

export function dayCloseAskedId(day: string): string {
  return `${DAY_CLOSE_ASKED_PREFIX}${day}`;
}

export async function loadCarryOverIds(
  db: WorkieDB,
  day: string,
): Promise<string[]> {
  const row = await db.settings.get(carryOverSettingId(day));
  return parseJson<string[]>(row?.value, []);
}

export async function saveCarryOverIds(
  db: WorkieDB,
  day: string,
  ids: readonly string[],
  now: number,
): Promise<void> {
  const id = carryOverSettingId(day);
  const existing = await db.settings.get(id);
  await db.settings.put({
    id,
    value: JSON.stringify([...ids]),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function wasDayCloseAsked(
  db: WorkieDB,
  previousDay: string,
): Promise<boolean> {
  const row = await db.settings.get(dayCloseAskedId(previousDay));
  return row?.value === "1";
}

export async function markDayCloseAsked(
  db: WorkieDB,
  previousDay: string,
  now: number,
): Promise<void> {
  const id = dayCloseAskedId(previousDay);
  const existing = await db.settings.get(id);
  await db.settings.put({
    id,
    value: "1",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
