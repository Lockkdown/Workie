import { useState, type FormEvent, type JSX } from "react";
import { localUserSource } from "../desk/boardContract";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import type { StatusHistoryEvent, Task, Weekday } from "../domain/types";
import { persistCreatedTask, type CreateTaskFields } from "./boardActions";
import { COPY, WEEKDAY_OPTIONS } from "./copy";
import { appDb } from "../shell/appDb";

export type TaskFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: { task: Task; history: StatusHistoryEvent[] }) => void;
  initialRepeat?: boolean;
};

export function TaskForm({
  open,
  onClose,
  onCreated,
  initialRepeat = false,
}: TaskFormProps): JSX.Element | null {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([""]);
  const [repeat, setRepeat] = useState(initialRepeat);
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const source = localUserSource();

  if (!open) {
    return null;
  }

  function toggleWeekday(value: Weekday): void {
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError(COPY.titleRequired);
      return;
    }
    if (repeat && weekdays.length === 0) {
      setError(COPY.weekdayRequired);
      return;
    }
    const fields: CreateTaskFields = {
      title: trimmed,
      description,
      subtasks: subtasks.map((item) => ({ title: item })),
      repeatWeekdays: repeat ? weekdays : undefined,
    };
    setPending(true);
    setError(undefined);
    try {
      const created = await persistCreatedTask(appDb, fields);
      onCreated?.(created);
      setTitle("");
      setDescription("");
      setSubtasks([""]);
      setRepeat(initialRepeat);
      setWeekdays([]);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title={COPY.createTask} ornament="panel" role="dialog">
      <form
        className="task-board-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="task-board-form-row">
          <label className="type-body-m" htmlFor="task-form-title">
            {COPY.title} *
          </label>
          <input
            id="task-form-title"
            className="type-body-m"
            name="title"
            required
            aria-required="true"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="task-board-form-row">
          <label className="type-body-m" htmlFor="task-form-description">
            {COPY.description}
          </label>
          <textarea
            id="task-form-description"
            className="type-body-m"
            name="description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <fieldset className="task-board-form-row">
          <legend className="type-body-m">{COPY.subtasks}</legend>
          {subtasks.map((item, index) => (
            <div
              key={`subtask-${String(index)}`}
              className="task-board-form-row"
            >
              <input
                className="type-body-m"
                name={`subtask-${String(index)}`}
                aria-label={`${COPY.subtasks} ${String(index + 1)}`}
                value={item}
                onChange={(event) => {
                  const value = event.target.value;
                  setSubtasks((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? value : entry,
                    ),
                  );
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="compact"
                ornament="dense"
                aria-label={`${COPY.removeSubtask} ${String(index + 1)}`}
                onClick={() =>
                  setSubtasks((current) =>
                    current.filter((_, entryIndex) => entryIndex !== index),
                  )
                }
              >
                {COPY.removeSubtask}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="compact"
            ornament="dense"
            onClick={() => setSubtasks((current) => [...current, ""])}
          >
            {COPY.addSubtask}
          </Button>
        </fieldset>
        <label className="type-body-m">
          <input
            type="checkbox"
            name="repeat"
            checked={repeat}
            onChange={(event) => setRepeat(event.target.checked)}
          />{" "}
          {COPY.repeat}
        </label>
        {repeat ? (
          <fieldset
            className="task-board-form-row"
            data-weekday-selector="true"
          >
            <legend className="type-body-m">{COPY.weekdayGroup}</legend>
            <div className="task-board-weekdays">
              {WEEKDAY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="secondary"
                  size="compact"
                  ornament="dense"
                  aria-pressed={weekdays.includes(option.value)}
                  onClick={() => toggleWeekday(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <p className="type-body-s" data-signal="source">
          {COPY.sourceCreator}: {COPY.currentAccount} ({source.accountId})
        </p>
        {error ? (
          <p className="type-body-s" data-form-error="true">
            {error}
          </p>
        ) : null}
        <div className="task-board-form-actions">
          <Button
            type="button"
            variant="secondary"
            size="primary"
            ornament="dense"
            onClick={onClose}
          >
            {COPY.formCancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="primary"
            ornament="dense"
            disabled={pending}
          >
            {COPY.createTask}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
