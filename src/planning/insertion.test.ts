import { describe, expect, it } from "vitest";
import { createDayPlan, scheduleTask } from "../calendar/index";
import { createTask } from "../domain/taskModel";
import { applyRevision, emptyDocument } from "./ritual";

const NOW = new Date(2026, 8, 14, 10, 0, 0, 0).getTime();
const source = { kind: "user" as const, accountId: "local" };

describe("in-day insertion [D22]", () => {
  it("previews without changing the plan until confirm, and does not change status", () => {
    const task = createTask({
      id: "t1",
      title: "Interrupt",
      now: NOW,
      source,
    }).task;
    const plan = createDayPlan("2026-09-14");
    const preview = scheduleTask(
      plan,
      {
        id: "b1",
        taskId: task.id,
        type: "flexible",
        durationMs: 30 * 60_000,
        precedingAnchorId: null,
        chainPosition: 0,
      },
      { confirmed: false },
    );
    expect(preview.confirmed).toBe(false);
    expect(plan.blocks).toHaveLength(0);
    expect(task.status).toBe("Waiting");
    const confirmed = { ...preview, confirmed: true };
    expect(confirmed.next.blocks).toHaveLength(1);
    expect(confirmed.next.blocks[0]?.kind).toBe("task");
    const doc = applyRevision(
      { ...emptyDocument("2026-09-14", NOW), commitState: "committed" },
      confirmed.next,
      "rev",
      NOW,
    );
    expect(doc.commitState).toBe("committed");
    expect(doc.revisions).toHaveLength(1);
    expect(task.status).toBe("Waiting");
  });
});
