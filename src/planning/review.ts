import {
  conflictInfos,
  evaluateOverload,
  packDay,
  type DayPlan,
  type OverloadIssue,
} from "../calendar/index";

export type NamedIssue = {
  kind: string;
  label: string;
  blockIds: string[];
};

function spanLabel(startMs: number, endMs: number): string {
  const a = new Date(startMs);
  const b = new Date(endMs);
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmt(a)}–${fmt(b)}`;
}

function overloadLabel(issue: OverloadIssue): string {
  if (issue.kind === "overlappingFixed") {
    return `Overlapping fixed blocks ${issue.blockIds.join(", ")} (${spanLabel(issue.span.startMs, issue.span.endMs)})`;
  }
  if (issue.kind === "chainExceedsCapacity") {
    return `Chain exceeds capacity for ${issue.blockIds.join(", ")} (${spanLabel(issue.span.startMs, issue.span.endMs)})`;
  }
  return `Unresolved conflict on ${issue.blockIds.join(", ")}`;
}

export function namedReviewIssues(plan: DayPlan): NamedIssue[] {
  const overload = evaluateOverload(plan);
  const packed = packDay(plan);
  const conflicts = conflictInfos(packed);
  const issues: NamedIssue[] = overload.issues.map((issue) => ({
    kind: issue.kind,
    label: overloadLabel(issue),
    blockIds: [...issue.blockIds],
  }));
  for (const conflict of conflicts) {
    issues.push({
      kind: "conflict",
      label: `Conflict at anchor ${conflict.anchorId}: ${conflict.affectedBlockIds.join(", ")}`,
      blockIds: conflict.affectedBlockIds,
    });
  }
  return issues;
}
