import { useState, type FormEvent } from "react";
import {
  scheduleTask,
  type DayPlan,
  type MutationPreview,
} from "../calendar/index";
import { persistNewTask } from "../db/taskPersistence";
import type { WorkieDB } from "../db/schema";
import { localUserSource } from "../desk/boardContract";
import type { Task } from "../domain/types";
import { isLiveStatus } from "../domain/types";
import { newId } from "../id";
import { parseWorkieDayStart } from "../domain/workieDay";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { COPY } from "./copy";
import { previewRows } from "../timeline/schedule";
import { applyRevision } from "./ritual";
import type { PlanningDocument } from "./types";
import { savePlanningDocument } from "./persist";

export type InDayInsertionProps = {
  plan: DayPlan;
  tasks: readonly Task[];
  db: WorkieDB;
  planningDoc: PlanningDocument | null;
  onApply: (preview: MutationPreview) => void;
  onPlanningDoc?: (doc: PlanningDocument) => void;
};

export function InDayInsertion({
  plan,
  tasks,
  db,
  planningDoc,
  onApply,
  onPlanningDoc,
}: InDayInsertionProps) {
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"fixed" | "flexible">("flexible");
  const [durationMin, setDurationMin] = useState(30);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [chainPosition, setChainPosition] = useState(0);
  const [preview, setPreview] = useState<MutationPreview | null>(null);
  const live = tasks.filter((task) => isLiveStatus(task.status));
  const titles = new Map(tasks.map((task) => [task.id, task.title]));

  function buildPreview(forTaskId: string): MutationPreview {
    const durationMs = durationMin * 60_000;
    const id = newId();
    if (type === "fixed") {
      const startMs =
        parseWorkieDayStart(plan.day) + hour * 3_600_000 + minute * 60_000;
      return scheduleTask(
        plan,
        {
          id,
          taskId: forTaskId,
          type: "fixed",
          startMs,
          endMs: startMs + durationMs,
        },
        { confirmed: false },
      );
    }
    return scheduleTask(
      plan,
      {
        id,
        taskId: forTaskId,
        type: "flexible",
        durationMs,
        precedingAnchorId: null,
        chainPosition,
      },
      { confirmed: false },
    );
  }

  async function handlePreview(event: FormEvent) {
    event.preventDefault();
    let id = taskId;
    if (id.length === 0 && title.trim().length > 0) {
      const created = await persistNewTask(db, {
        title: title.trim(),
        source: localUserSource(),
      });
      id = created.task.id;
      setTaskId(id);
    }
    if (id.length === 0) {
      return;
    }
    setPreview(buildPreview(id));
  }

  function handleConfirm() {
    if (!preview) {
      return;
    }
    onApply({ ...preview, confirmed: true });
    if (
      planningDoc?.day === plan.day &&
      planningDoc.commitState === "committed"
    ) {
      const next = applyRevision(
        planningDoc,
        preview.next,
        newId(),
        Date.now(),
      );
      void savePlanningDocument(db, next);
      onPlanningDoc?.(next);
    }
    setOpen(false);
    setPreview(null);
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="primary"
        onClick={() => setOpen(true)}
      >
        {COPY.insertTitle}
      </Button>
      {open ? (
        <Panel title={COPY.insertTitle} role="dialog" ornament="panel">
          {preview ? (
            <>
              <ul>
                {previewRows(plan, preview, titles).map((row) => (
                  <li key={row.id}>
                    {row.title}: {row.span}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={handleConfirm}
              >
                {COPY.confirmInsert}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={() => setPreview(null)}
              >
                {COPY.cancel}
              </Button>
            </>
          ) : (
            <form
              className="plan-fields"
              onSubmit={(event) => void handlePreview(event)}
            >
              <label className="type-body-s">
                {COPY.pickTask}
                <select
                  value={taskId}
                  onChange={(event) => setTaskId(event.target.value)}
                >
                  <option value=""> </option>
                  {live.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="type-body-s">
                {COPY.newTask}
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <p className="type-body-s">{COPY.chooseType}</p>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                aria-pressed={type === "fixed"}
                onClick={() => setType("fixed")}
              >
                {COPY.fixed}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                aria-pressed={type === "flexible"}
                onClick={() => setType("flexible")}
              >
                {COPY.flexible}
              </Button>
              <label className="type-body-s">
                {COPY.duration}
                <input
                  type="number"
                  min={5}
                  value={durationMin}
                  onChange={(event) =>
                    setDurationMin(Number(event.target.value))
                  }
                />
              </label>
              {type === "fixed" ? (
                <>
                  <label className="type-body-s">
                    {COPY.startHour}
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={hour}
                      onChange={(event) => setHour(Number(event.target.value))}
                    />
                  </label>
                  <label className="type-body-s">
                    {COPY.startMinute}
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={minute}
                      onChange={(event) =>
                        setMinute(Number(event.target.value))
                      }
                    />
                  </label>
                </>
              ) : (
                <label className="type-body-s">
                  {COPY.chainPosition}
                  <input
                    type="number"
                    min={0}
                    value={chainPosition}
                    onChange={(event) =>
                      setChainPosition(Number(event.target.value))
                    }
                  />
                </label>
              )}
              <Button type="submit" variant="secondary" size="primary">
                {COPY.previewInsert}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                onClick={() => setOpen(false)}
              >
                {COPY.cancel}
              </Button>
            </form>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
