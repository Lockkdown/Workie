import { describe, expect, it } from "vitest";
import * as transitions from "./transitions";
import { createOccurrence, createTask, setBlockIds } from "./taskModel";
import {
  abandon,
  cancel,
  complete,
  moveLiveStatus,
  reorderLive,
  restore,
} from "./transitions";

const source = { kind: "user" as const, accountId: "local" };
const now = 1_000;

function seedTask(id = "t1") {
  return createTask({ id, title: "Task", now, source });
}

describe("transitions [D14] [D4] [D12] [D99]", () => {
  it("moves only among live statuses via moveLiveStatus", () => {
    const seeded = seedTask();
    const next = moveLiveStatus(
      seeded.task,
      "In Progress",
      now + 1,
      seeded.history,
    );
    expect(next.entity.status).toBe("In Progress");
    const deferred = moveLiveStatus(
      next.entity,
      "Deferred",
      now + 2,
      next.history,
    );
    expect(deferred.entity.status).toBe("Deferred");
    const waiting = moveLiveStatus(
      deferred.entity,
      "Waiting",
      now + 3,
      deferred.history,
    );
    expect(waiting.entity.status).toBe("Waiting");
  });

  it("reorderLive changes order and not status", () => {
    const seeded = seedTask();
    const reordered = reorderLive(seeded.task, 4, now + 1);
    expect(reordered.status).toBe("Waiting");
    expect(reordered.liveOrder).toBe(4);
  });

  it("does not expose a Closed reorder API", () => {
    expect("reorderClosed" in transitions).toBe(false);
  });

  it("reaches Completed only through complete, never moveLiveStatus", () => {
    const seeded = seedTask();
    expect(() =>
      moveLiveStatus(
        seeded.task,
        "Completed" as unknown as "Waiting",
        now + 1,
        seeded.history,
      ),
    ).toThrow(/Final outcomes|live status|drag/i);
    const closed = complete(seeded.task, now + 1, seeded.history);
    expect(closed.entity.status).toBe("Completed");
  });

  it("requires confirmation for abandon and cancel, never from drag", () => {
    const seeded = seedTask();
    expect(() =>
      abandon(
        seeded.task,
        { confirmed: false } as unknown as { confirmed: true },
        now + 1,
        seeded.history,
      ),
    ).toThrow(/confirmation/);
    expect(() =>
      cancel(
        seeded.task,
        { confirmed: false } as unknown as { confirmed: true },
        now + 1,
        seeded.history,
      ),
    ).toThrow(/confirmation/);
    expect(
      abandon(seeded.task, { confirmed: true }, now + 1, seeded.history).entity
        .status,
    ).toBe("Abandoned");
    expect(
      cancel(seeded.task, { confirmed: true }, now + 1, seeded.history).entity
        .status,
    ).toBe("Cancelled");
  });

  it("restore returns Waiting and preserves focus history [D14]", () => {
    const seeded = seedTask();
    const withFocus = {
      ...seeded.task,
      focusHistory: ["session-1", "session-2"],
    };
    const closed = complete(withFocus, now + 1, seeded.history);
    const restored = restore(closed.entity, now + 2, closed.history);
    expect(restored.entity.status).toBe("Waiting");
    expect(restored.entity.focusHistory).toEqual(["session-1", "session-2"]);
  });

  it("completing a task does not delete or alter blockIds [D12] [D39]", () => {
    const seeded = seedTask();
    const planned = setBlockIds(seeded.task, ["b1", "b2"], now + 1);
    const closed = complete(planned, now + 2, seeded.history);
    expect(closed.entity.blockIds).toEqual(["b1", "b2"]);
  });

  it("uses the same state machine for occurrences [D99]", () => {
    const { occurrence, history } = createOccurrence({
      id: "o1",
      taskId: "t1",
      date: "2026-06-16",
      now,
    });
    const moved = moveLiveStatus(occurrence, "In Progress", now + 1, history);
    expect(moved.entity.status).toBe("In Progress");
    const closed = complete(moved.entity, now + 2, moved.history);
    expect(closed.entity.status).toBe("Completed");
    const restored = restore(closed.entity, now + 3, closed.history);
    expect(restored.entity.status).toBe("Waiting");
    expect(restored.entity.date).toBe("2026-06-16");
  });

  it("does not export timer, block, cycle or AI status APIs [D4] [D36] [D38] [D58]", () => {
    const forbidden = [
      "completeFromTimer",
      "completeFromBlock",
      "completeFromCycle",
      "completeFromAi",
      "applyTimerStatus",
      "applyAiStatus",
    ];
    for (const name of forbidden) {
      expect(Object.hasOwn(transitions, name)).toBe(false);
    }
  });

  it("does not let reorderLive run on Closed", () => {
    const seeded = seedTask();
    const closed = complete(seeded.task, now + 1, seeded.history);
    expect(() => reorderLive(closed.entity, 1, now + 2)).toThrow(
      /cannot be hand-sorted/,
    );
  });
});
