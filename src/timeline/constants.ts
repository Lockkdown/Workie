/** Default duration when scheduling a free pick [D6]. */
export const DEFAULT_DURATION_MS = 30 * 60 * 1000;

/** Snap grid for drop, move and resize. */
export const SNAP_MS = 5 * 60 * 1000;

export const HOURS_IN_DAY = 24;
export const HOUR_HEIGHT_PX = 48;
export const AXIS_HEIGHT_PX = HOUR_HEIGHT_PX * HOURS_IN_DAY;
export const MINUTES_IN_DAY = HOURS_IN_DAY * 60;

export const DAY_PLAN_SETTING_PREFIX = "dayPlan:";

export function dayPlanSettingId(day: string): string {
  return `${DAY_PLAN_SETTING_PREFIX}${day}`;
}

export const WORKIE_BLOCK_DRAG = "application/x-workie-block";
