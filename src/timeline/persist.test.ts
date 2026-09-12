import { afterEach, describe, expect, it } from "vitest";
import {
  createDayPlan,
  createFixedTaskBlock,
  unschedule,
} from "../calendar/index";
import { WorkieDB } from "../db/schema";
import { loadTaskState, persistNewTask } from "../db/taskPersistence";
import { loadDayPlan, persistDayPlan } from "./persist";

const opened: WorkieDB[] = [];

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

const DAY = "2026-06-15";
const noon = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
const source = { kind: "user" as const, accountId: "local" };

function openDb(): WorkieDB {
  const db = new WorkieDB(`timeline-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

describe("timeline persistence [D6] [D96]", () => {
  it("unschedules a block without changing task status", async () => {
    const db = openDb();
    await db.open();
    expect(db.verno).toBe(5);
    const seeded = await persistNewTask(db, {
      id: "t-a",
      title: "Keep status",
      source,
      now: noon,
    });
    expect(seeded.task.status).toBe("Waiting");
    const empty = createDayPlan(DAY);
    const scheduled = createDayPlan(DAY, [
      createFixedTaskBlock({
        id: "b1",
        taskId: "t-a",
        day: DAY,
        startMs: noon,
        endMs: noon + 30 * 60 * 1000,
      }),
    ]);
    await persistDayPlan(db, empty, scheduled, noon);
    const afterSchedule = await loadTaskState(db);
    const scheduledTask = afterSchedule.tasks.find((item) => item.id === "t-a");
    expect(scheduledTask?.status).toBe("Waiting");
    expect(scheduledTask?.blockIds).toEqual(["b1"]);
    const roundTrip = await loadDayPlan(db, DAY);
    expect(roundTrip.blocks).toHaveLength(1);
    expect(roundTrip.blocks[0]?.id).toBe("b1");

    const removed = unschedule(scheduled, "b1", { confirmed: true });
    await persistDayPlan(db, scheduled, removed.next, noon + 1);
    const afterUnschedule = await loadTaskState(db);
    const stillWaiting = afterUnschedule.tasks.find(
      (item) => item.id === "t-a",
    );
    expect(stillWaiting?.status).toBe("Waiting");
    expect(stillWaiting?.blockIds).toEqual([]);
    expect(await db.blocks.where("day").equals(DAY).count()).toBe(0);
  });

  it("stores running extras in settings as dayPlan JSON", async () => {
    const db = openDb();
    await db.open();
    const plan = createDayPlan(
      DAY,
      [
        createFixedTaskBlock({
          id: "b1",
          taskId: "t-a",
          day: DAY,
          startMs: noon,
          endMs: noon + 30 * 60 * 1000,
        }),
      ],
      { runningBlockId: "b1", chainStartDelayMs: { b1: 0 } },
    );
    await persistDayPlan(db, createDayPlan(DAY), plan, noon);
    const loaded = await loadDayPlan(db, DAY);
    expect(loaded.runningBlockId).toBe("b1");
    const extras = await db.settings.get(`dayPlan:${DAY}`);
    expect(extras?.value).toContain("runningBlockId");
    expect(await db.blocks.where("taskId").equals("t-a").count()).toBe(1);
  });
});
