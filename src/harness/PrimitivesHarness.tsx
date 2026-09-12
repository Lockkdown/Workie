import type { FormEvent } from "react";
import { Button } from "../ui/Button";
import { FileControl } from "../ui/FileControl";
import { Panel } from "../ui/Panel";
import { ContributionLegend, ProgressStatus } from "../ui/ProgressStatus";
import { TaskCard } from "../ui/TaskCard";
import { TimeBlock } from "../ui/TimeBlock";
import { TASK_STATUSES } from "../ui/types";
import "./primitives-harness.css";

const FIELD_CONTROLS = [
  "text",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "number",
  "file",
] as const;

function preventSubmit(event: FormEvent<HTMLFormElement>): void {
  event.preventDefault();
}

function FieldChromeBoard({ theme }: { theme: "dark" | "light" }) {
  const invalidId = `${theme}-field-invalid`;
  const radioName = `${theme}-field-theme`;

  return (
    <div className="primitives-field-chrome" data-concept="field-chrome">
      <h3 className="type-display-m">Field chrome</h3>
      <form className="primitives-field-grid" onSubmit={preventSubmit}>
        <label className="type-body-m" htmlFor={`${theme}-field-text`}>
          Title
          <input
            id={`${theme}-field-text`}
            name={`${theme}-title`}
            type="text"
            data-control="text"
            placeholder="Add a title"
          />
        </label>
        <label className="type-body-m" htmlFor={`${theme}-field-textarea`}>
          Notes
          <textarea
            id={`${theme}-field-textarea`}
            name={`${theme}-notes`}
            data-control="textarea"
            rows={3}
            placeholder="Add notes"
          />
        </label>
        <label className="type-body-m" htmlFor={`${theme}-field-select`}>
          Choice
          <select
            id={`${theme}-field-select`}
            name={`${theme}-choice`}
            data-control="select"
            defaultValue="Waiting"
          >
            <option>Waiting</option>
            <option>In Progress</option>
            <option>Deferred</option>
          </select>
        </label>
        <label className="type-body-m primitives-field-inline">
          <input
            type="checkbox"
            name={`${theme}-repeat`}
            data-control="checkbox"
          />
          Repeat
        </label>
        <fieldset>
          <legend className="type-body-m">Theme</legend>
          <label className="type-body-m primitives-field-inline">
            <input
              type="radio"
              name={radioName}
              value="System"
              data-control="radio"
              defaultChecked
            />
            System
          </label>
          <label className="type-body-m primitives-field-inline">
            <input type="radio" name={radioName} value="Dark" />
            Dark
          </label>
          <label className="type-body-m primitives-field-inline">
            <input type="radio" name={radioName} value="Light" />
            Light
          </label>
        </fieldset>
        <label className="type-body-m" htmlFor={`${theme}-field-number`}>
          Count
          <input
            id={`${theme}-field-number`}
            name={`${theme}-count`}
            type="number"
            data-control="number"
            defaultValue={25}
          />
        </label>
        <FileControl
          id={`${theme}-field-file`}
          name={`${theme}-batch`}
          label="Batch file"
          data-control="file"
        />
        <label className="type-body-m" htmlFor={`${theme}-field-invalid`}>
          Title
          <input
            id={`${theme}-field-invalid`}
            name={`${theme}-invalid-title`}
            aria-invalid="true"
            aria-describedby={invalidId}
            defaultValue=""
          />
        </label>
        <p id={invalidId} className="type-body-s" data-field-state="invalid">
          Invalid
        </p>
        <label className="type-body-m" htmlFor={`${theme}-field-disabled`}>
          Title
          <input
            id={`${theme}-field-disabled`}
            name={`${theme}-disabled-title`}
            disabled
            defaultValue="Held"
          />
        </label>
        <p className="type-body-s" data-field-state="disabled">
          Disabled
        </p>
        <div className="workie-scroll primitives-scroll" data-scroll="harness">
          <p className="type-body-m">
            Scroll container for field chrome tokens. Extra lines keep the bar.
          </p>
          <p className="type-body-m">Waiting</p>
          <p className="type-body-m">In Progress</p>
          <p className="type-body-m">Deferred</p>
          <p className="type-body-m">Completed</p>
          <p className="type-body-m">Abandoned</p>
          <p className="type-body-m">Cancelled</p>
        </div>
        <details>
          <summary className="type-body-s">More actions</summary>
          <p className="type-body-s">
            Abandoned and Cancelled stay in this list.
          </p>
        </details>
      </form>
    </div>
  );
}

function ThemeBoard({ theme }: { theme: "dark" | "light" }) {
  const label = theme === "dark" ? "Dark" : "Light";

  return (
    <section
      className="primitives-theme-board"
      data-theme={theme}
      data-surface="theme-board"
      aria-label={`${label} primitives`}
    >
      <h3 className="type-display-m">{label}</h3>
      <p className="type-timer">25:00</p>
      <div className="ui-compact-cluster">
        <Button variant="secondary" size="compact" ornament="dense">
          Edit
        </Button>
        <Button variant="destructive" size="compact" ornament="dense">
          Cancel
        </Button>
      </div>
      <div className="primitives-grid">
        {TASK_STATUSES.map((status) => (
          <TaskCard
            key={status}
            status={status}
            title="Sample task title"
            ornament="dense"
          />
        ))}
      </div>
      <TimeBlock
        status="Waiting"
        blockType="fixed"
        title="Morning block"
        ornament="dense"
      />
      <TimeBlock
        status="In Progress"
        blockType="flexible"
        title="Afternoon chain"
        ornament="dense"
      />
      <TimeBlock
        status="Deferred"
        blockType="flexible"
        title="Blocked chain"
        ornament="dense"
        conflict
      />
      <Panel title="Panel" ornament="panel">
        <p>Panel copy stays in Inter.</p>
      </Panel>
      <Panel title="Dialog" ornament="panel" role="dialog">
        <p>Dialog copy stays in Inter.</p>
        <Button variant="primary" ornament="panel">
          Confirm
        </Button>
      </Panel>
      <ProgressStatus status="In Progress" value={40} ornament="dense" />
      <ContributionLegend />
      <FieldChromeBoard theme={theme} />
    </section>
  );
}

export function PrimitivesHarness() {
  return (
    <aside className="primitives-harness" data-testid="primitives-harness">
      <h2 className="type-display-l">Primitives</h2>
      <ThemeBoard theme="dark" />
      <ThemeBoard theme="light" />
    </aside>
  );
}

export { FIELD_CONTROLS };
