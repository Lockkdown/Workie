import { describe, expect, it } from "vitest";
import {
  countStatusEventsOnDay,
  lastClosingTime,
  projectDisplayedOutcome,
  recordStatusEvent,
  sortClosedByClosingTime,
} from "./statusHistory";
import { createTask } from "./taskModel";
import { complete, moveLiveStatus, restore } from "./transitions";
import { workieDayKey } from "./workieDay";

const source = { kind: "user" as const, accountId: "local" };

describe("status history [D14] [D50] [D99]", () => {
  it("records one event per status per Workie day when entering the same status twice", () => {
    const now = new Date(2026, 5, 15, 9, 0, 0, 0).getTime();
    const later = new Date(2026, 5, 15, 18, 0, 0, 0).getTime();
    const seeded = createTask({ id: "t1", title: "T", now, source });
    const inProgress = moveLiveStatus(
      seeded.task,
      "In Progress",
      now + 1,
      seeded.history,
    );
    const waitingAgain = moveLiveStatus(
      inProgress.entity,
      "Waiting",
      later,
      inProgress.history,
    );
    const day = workieDayKey(now);
    expect(
      countStatusEventsOnDay(waitingAgain.history, "t1", "Waiting", day),
    ).toBe(1);
    expect(
      countStatusEventsOnDay(waitingAgain.history, "t1", "In Progress", day),
    ).toBe(1);
    expect(waitingAgain.entity.status).toBe("Waiting");
  });

  it("does not rewrite recorded events on restore", () => {
    const dayOne = new Date(2026, 5, 15, 10, 0, 0, 0).getTime();
    const dayTwo = new Date(2026, 5, 16, 10, 0, 0, 0).getTime();
    const seeded = createTask({ id: "t1", title: "T", now: dayOne, source });
    const closed = complete(seeded.task, dayOne + 1, seeded.history);
    const snapshot = closed.history.map((event) => ({ ...event }));
    const restored = restore(closed.entity, dayTwo, closed.history);
    for (const event of snapshot) {
      expect(restored.history.find((item) => item.id === event.id)).toEqual(
        event,
      );
    }
    expect(restored.entity.status).toBe("Waiting");
    expect(
      projectDisplayedOutcome(restored.entity.status, restored.history),
    ).toEqual({ currentStatus: "Waiting" });
  });

  it("sorts closed entities by most recent closing time [D14]", () => {
    const t1 = { id: "older" };
    const t2 = { id: "newer" };
    const history = recordStatusEvent([], {
      entityId: "older",
      entityKind: "task",
      status: "Completed",
      now: 10,
    });
    const withBoth = recordStatusEvent(history, {
      entityId: "newer",
      entityKind: "task",
      status: "Abandoned",
      now: 20,
    });
    expect(
      sortClosedByClosingTime([t1, t2], withBoth).map((item) => item.id),
    ).toEqual(["newer", "older"]);
    expect(lastClosingTime("newer", withBoth)).toBe(20);
  });

  it("does not store a separate outcome enum [D99]", () => {
    const seeded = createTask({
      id: "t1",
      title: "T",
      now: 1,
      source,
    });
    const projected = projectDisplayedOutcome(
      seeded.task.status,
      seeded.history,
    );
    expect(projected).toEqual({ currentStatus: "Waiting" });
    expect("outcome" in projected).toBe(false);
    expect("outcome" in seeded.task).toBe(false);
  });
});
