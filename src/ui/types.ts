export const ORNAMENT_TIERS = ["shell", "panel", "dense"] as const;
export type OrnamentTier = (typeof ORNAMENT_TIERS)[number];

export const TASK_STATUSES = [
  "Waiting",
  "In Progress",
  "Deferred",
  "Completed",
  "Abandoned",
  "Cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type SemanticState = TaskStatus | "Conflict";

export const BLOCK_TYPES = ["fixed", "flexible"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export function statusSlug(status: SemanticState): string {
  if (status === "In Progress") {
    return "in-progress";
  }
  return status.toLowerCase();
}
