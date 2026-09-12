import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CONFLICT_RESOLUTIONS,
  conflictInfos,
  createDayPlan,
  createFixedReserveBlock,
  createFixedTaskBlock,
  createFlexibleTaskBlock,
  packDay,
  scheduleTask,
  setRunningBlock,
} from "../calendar/index";
import { serializeTaskDrag } from "../desk/taskDrag";
import { createTask } from "../domain/taskModel";
import { COPY, CONFLICT_RESOLUTION_COPY } from "./copy";
import {
  payloadFromDropData,
  previewConvert,
  previewScheduleFromDrop,
} from "./schedule";
import { TimelineSurface } from "./TimelineSurface";
import { ReserveChrome } from "./ReserveChrome";

const DAY = "2026-06-15";
const HOUR = 60 * 60 * 1000;

function local(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

const noon = local(2026, 5, 15, 12);
const source = { kind: "user" as const, accountId: "local" };

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "timeline.css"),
  "utf8",
);

function task(id: string, title: string) {
  return createTask({ id, title, now: noon, source }).task;
}

function renderSurface(
  overrides: Partial<Parameters<typeof TimelineSurface>[0]> = {},
) {
  const plan = overrides.plan ?? createDayPlan(DAY);
  return renderToStaticMarkup(
    createElement(TimelineSurface, {
      plan,
      tasks: overrides.tasks ?? [],
      now: overrides.now ?? noon,
      loadState: overrides.loadState ?? "ready",
      errorCause: overrides.errorCause ?? null,
      offline: overrides.offline ?? false,
      saveLabel: overrides.saveLabel ?? COPY.savedLocally,
      preview: overrides.preview ?? null,
      partialFailures: overrides.partialFailures ?? {},
      onPropose: overrides.onPropose ?? (() => undefined),
      onApply: overrides.onApply ?? (() => undefined),
      onCancel: overrides.onCancel ?? (() => undefined),
      onRetry: overrides.onRetry ?? (() => undefined),
      onMarkRunning: overrides.onMarkRunning ?? (() => undefined),
      seedDraft: overrides.seedDraft,
      initialSelectedId: overrides.initialSelectedId,
    }),
  );
}

function busyPlan() {
  return createDayPlan(DAY, [
    createFlexibleTaskBlock({
      id: "a",
      taskId: "t-a",
      day: DAY,
      durationMs: 3 * HOUR,
      chainPosition: 0,
      precedingAnchorId: null,
    }),
    createFixedTaskBlock({
      id: "meet",
      taskId: "t-meet",
      day: DAY,
      startMs: local(2026, 5, 15, 2),
      endMs: local(2026, 5, 15, 3),
    }),
    createFixedReserveBlock({
      id: "lunch",
      day: DAY,
      startMs: noon,
      endMs: noon + HOUR,
    }),
  ]);
}

describe("hour axis [D25]", () => {
  it("renders one Workie day with hours 00 through 24", () => {
    const html = renderSurface({
      plan: createDayPlan(DAY),
      now: noon,
    });
    expect(html).toContain('data-testid="hour-axis"');
    expect(html).toContain('data-calendar-drop="true"');
    for (let hour = 0; hour <= 24; hour += 1) {
      expect(html).toContain(`data-hour="${hour}"`);
    }
    expect(html).toContain("00:00");
    expect(html).toContain("24:00");
    const later = renderSurface({
      plan: createDayPlan(DAY, [
        createFixedTaskBlock({
          id: "meet",
          taskId: "t-meet",
          day: DAY,
          startMs: noon,
          endMs: noon + HOUR,
        }),
      ]),
      now: noon + HOUR,
      tasks: [task("t-meet", "Standup")],
    });
    expect(later).toContain('data-block-id="meet"');
    const nowMarks = later.match(/data-now-marker="true"[^>]*style="([^"]*)"/);
    expect(nowMarks?.[1]).toContain("top:");
  });
});

describe("drop payload schedules only after confirm [D23] [D28]", () => {
  it("parses a drop payload and previews without applying", () => {
    const plan = createDayPlan(DAY);
    const raw = serializeTaskDrag({ taskId: "t-a" });
    const payload = payloadFromDropData(raw);
    expect(payload).toEqual({ taskId: "t-a" });
    const preview = previewScheduleFromDrop(
      plan,
      payload!,
      "fixed",
      {
        startMs: noon,
        durationMs: 30 * 60 * 1000,
        precedingAnchorId: null,
        chainPosition: 0,
      },
      "block-1",
    );
    expect(preview.confirmed).toBe(false);
    expect(plan.blocks).toHaveLength(0);
    expect(preview.next.blocks).toHaveLength(1);
    const html = renderSurface({ plan, preview });
    expect(html).toContain(COPY.applyPreview);
    expect(html).toContain(COPY.cancel);
    expect(html).toContain(COPY.resultingTimes);
  });
});

describe("type conversion is labelled, not from drop [D28]", () => {
  it("shows Make Fixed / Make Flexible and drop helper never converts type", () => {
    const plan = createDayPlan(DAY, [
      createFixedTaskBlock({
        id: "meet",
        taskId: "t-meet",
        day: DAY,
        startMs: noon,
        endMs: noon + HOUR,
      }),
    ]);
    const html = renderSurface({
      plan,
      tasks: [task("t-meet", "Standup")],
      initialSelectedId: "meet",
    });
    expect(html).toContain(COPY.makeFlexible);
    expect(html).not.toContain(COPY.makeFixed);
    const dropPreview = previewScheduleFromDrop(
      createDayPlan(DAY),
      { taskId: "t-a" },
      "flexible",
      {
        startMs: noon,
        precedingAnchorId: null,
        chainPosition: 0,
      },
      "new-1",
    );
    expect(dropPreview.next.blocks[0]?.type).toBe("flexible");
    const converted = previewConvert(plan, "meet", "flexible");
    expect(
      converted.next.blocks.find((block) => block.id === "meet")?.type,
    ).toBe("flexible");
    const scheduleHtml = renderSurface({
      plan: createDayPlan(DAY),
      seedDraft: {
        kind: "task",
        taskId: "t-a",
        type: null,
        startMs: noon,
        durationMs: 30 * 60 * 1000,
        precedingAnchorId: null,
        chainPosition: 0,
        id: "draft-1",
      },
    });
    expect(scheduleHtml).toContain(COPY.chooseType);
    expect(scheduleHtml).toContain(COPY.fixed);
    expect(scheduleHtml).toContain(COPY.flexible);
  });
});

describe("preview before apply [D23]", () => {
  it("keeps the live plan empty until Apply preview", () => {
    const plan = createDayPlan(DAY);
    const preview = scheduleTask(
      plan,
      {
        id: "b1",
        taskId: "t-a",
        type: "fixed",
        startMs: noon,
        endMs: noon + 30 * 60 * 1000,
      },
      { confirmed: false },
    );
    const html = renderSurface({ plan, preview });
    expect(html).toContain(COPY.applyPreview);
    expect(html).toContain('data-variant="primary"');
    expect(plan.blocks).toHaveLength(0);
    expect(preview.confirmed).toBe(false);
  });
});

describe("conflict UI offers five resolutions [D27]", () => {
  it("lists every resolution including subordinate Keep Anyway", () => {
    const plan = busyPlan();
    expect(conflictInfos(packDay(plan)).length).toBeGreaterThan(0);
    const html = renderSurface({
      plan,
      tasks: [task("t-a", "Write"), task("t-meet", "Standup")],
    });
    for (const resolution of CONFLICT_RESOLUTIONS) {
      expect(html).toContain(CONFLICT_RESOLUTION_COPY[resolution]);
    }
    expect(html).toContain(COPY.keepAnyway);
    expect(html).toContain("Keep Anyway");
    const keepButtons = html.match(
      /data-variant="primary"[^>]*>[\s\S]*Keep Anyway/,
    );
    expect(keepButtons).toBeNull();
    expect(html).toContain("ui-conflict-pattern");
    expect(html).toContain("Conflict");
  });
});

describe("reserve has no status or complete [D29]", () => {
  it("renders Reserve chrome without task status or Complete", () => {
    const html = renderToStaticMarkup(
      createElement(ReserveChrome, { blockType: "fixed", conflict: false }),
    );
    expect(html).toContain(COPY.reserve);
    expect(html).toContain('data-reserve="true"');
    expect(html).toContain("Fixed");
    expect(html).not.toContain("Complete");
    expect(html).not.toContain("Waiting");
    expect(html).not.toContain("In Progress");
    const onAxis = renderSurface({
      plan: createDayPlan(DAY, [
        createFixedReserveBlock({
          id: "lunch",
          day: DAY,
          startMs: noon,
          endMs: noon + HOUR,
        }),
      ]),
    });
    expect(onAxis).toContain(COPY.reserve);
    expect(onAxis).toContain('data-reserve="true"');
    expect(onAxis).not.toContain("Complete");
  });
});

describe("empty loading error offline markup [D91]", () => {
  it("shows the empty motif and starting step", () => {
    const html = renderSurface({
      loadState: "ready",
      plan: createDayPlan(DAY),
    });
    expect(html).toContain("timeline-empty-motif");
    expect(html).toContain(COPY.emptyStep);
  });

  it("keeps the hour axis while loading", () => {
    const html = renderSurface({ loadState: "loading" });
    expect(html).toContain('data-testid="hour-axis"');
    expect(html).toContain("timeline-skeleton-lane");
    expect(html).toContain("00:00");
  });

  it("states the cause, that the schedule is unchanged, and Retry", () => {
    const html = renderSurface({
      errorCause: "IndexedDB quota exceeded",
    });
    expect(html).toContain("IndexedDB quota exceeded");
    expect(html).toContain(COPY.errorUnchanged);
    expect(html).toContain(COPY.retry);
  });

  it("shows an offline banner with label, icon, and save state", () => {
    const html = renderSurface({
      offline: true,
      saveLabel: COPY.savedLocally,
    });
    expect(html).toContain(COPY.offline);
    expect(html).toContain('data-icon="offline"');
    expect(html).toContain(COPY.savedLocally);
  });
});

describe("reduced-motion CSS [D89]", () => {
  it("moves blocks in 180ms and collapses under prefers-reduced-motion", () => {
    expect(css).toContain("--duration-move");
    expect(css).toContain("ease-out");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("--duration-opacity");
  });
});

describe("five-minute warning [D1] [D90]", () => {
  it("shows a muted labelled warning with an icon", () => {
    const base = createDayPlan(DAY, [
      createFixedTaskBlock({
        id: "run",
        taskId: "t-run",
        day: DAY,
        startMs: noon,
        endMs: noon + HOUR,
      }),
    ]);
    const plan = setRunningBlock(base, "run");
    const html = renderSurface({
      plan,
      now: noon + HOUR - 4 * 60 * 1000,
      tasks: [task("t-run", "Deep work")],
    });
    expect(html).toContain(COPY.fiveMinutes);
    expect(html).toContain('data-five-minute="true"');
    expect(html).toContain('data-muted="true"');
    expect(html).toContain('data-icon="warning"');
  });
});

describe("busy day density [D82] [D87]", () => {
  it("renders 30 tasks, mixed blocks, a conflict and a running block", () => {
    const tasks = Array.from({ length: 30 }, (_, index) =>
      task(`t-${index}`, `Task ${index} with a fairly long title for scan`),
    );
    const plan = setRunningBlock(
      createDayPlan(DAY, [
        createFlexibleTaskBlock({
          id: "chain-a",
          taskId: "t-0",
          day: DAY,
          durationMs: 3 * HOUR,
          chainPosition: 0,
          precedingAnchorId: null,
        }),
        createFixedTaskBlock({
          id: "anchor",
          taskId: "t-1",
          day: DAY,
          startMs: local(2026, 5, 15, 2),
          endMs: local(2026, 5, 15, 3),
        }),
        createFixedReserveBlock({
          id: "buffer",
          day: DAY,
          startMs: noon,
          endMs: noon + HOUR,
        }),
        createFlexibleTaskBlock({
          id: "chain-b",
          taskId: "t-2",
          day: DAY,
          durationMs: HOUR,
          chainPosition: 1,
          precedingAnchorId: null,
        }),
      ]),
      "chain-a",
    );
    expect(conflictInfos(packDay(plan)).length).toBeGreaterThan(0);
    const html = renderSurface({
      plan,
      tasks,
      now: local(2026, 5, 15, 1, 30),
    });
    expect(html).toContain("Task 0 with a fairly long title for scan");
    expect(html).toContain(COPY.conflict);
    expect(html).toContain("ui-conflict-pattern");
    expect(html).toContain(COPY.reserve);
    expect(html).toContain('data-running="true"');
    expect(css).toContain("overflow-x: hidden");
    expect(css).toMatch(/\.timeline-scroll\s*\{[^}]*overflow-x:\s*hidden/);
  });
});

describe("labelled non-drag equivalents [D83] [D92]", () => {
  it("exposes schedule, move, resize, unschedule, reorder, and convert", () => {
    const plan = createDayPlan(DAY, [
      createFlexibleTaskBlock({
        id: "a",
        taskId: "t-a",
        day: DAY,
        durationMs: HOUR,
        chainPosition: 0,
        precedingAnchorId: null,
      }),
    ]);
    const html = renderSurface({
      plan,
      tasks: [task("t-a", "Write")],
      initialSelectedId: "a",
    });
    expect(html).toContain(COPY.moveBlock);
    expect(html).toContain(COPY.resize);
    expect(html).toContain(COPY.unschedule);
    expect(html).toContain(COPY.reorderInChain);
    expect(html).toContain(COPY.makeFixed);
    expect(html).toContain(COPY.addReserve);
    expect(html).toContain(COPY.markAsRunning);
  });
});
