import { Panel } from "../ui/Panel";

export function PlanTomorrow() {
  return (
    <div className="plan-tomorrow">
      <Panel title="Plan Tomorrow" ornament="panel">
        <p>Plan the next day here.</p>
        <div data-primary-slot="plan-tomorrow" />
      </Panel>
    </div>
  );
}
