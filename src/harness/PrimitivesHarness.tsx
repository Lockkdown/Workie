import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { ContributionLegend, ProgressStatus } from "../ui/ProgressStatus";
import { TaskCard } from "../ui/TaskCard";
import { TimeBlock } from "../ui/TimeBlock";
import { TASK_STATUSES } from "../ui/types";

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
