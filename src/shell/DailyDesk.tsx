import { Button } from "../ui/Button";
import { DESK_MODES, type DeskMode } from "./destinations";

type DailyDeskProps = {
  mode: DeskMode;
  trayCollapsed: boolean;
  onMode: (mode: DeskMode) => void;
  onTrayCollapsed: (collapsed: boolean) => void;
};

export function DailyDesk({
  mode,
  trayCollapsed,
  onMode,
  onTrayCollapsed,
}: DailyDeskProps) {
  return (
    <section className="daily-desk" aria-labelledby="daily-desk-title">
      <header className="daily-desk-header">
        <h2 id="daily-desk-title" className="type-display-xl">
          Daily Desk
        </h2>
        <p className="type-body-l" data-testid="user-content">
          Việc cần làm
        </p>
      </header>
      <div
        className="desk-modes"
        role="radiogroup"
        aria-label="Daily Desk mode"
      >
        {DESK_MODES.map((name) => (
          <button
            key={name}
            type="button"
            className="desk-mode type-display-m"
            role="radio"
            aria-checked={mode === name}
            onClick={() => onMode(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="desk-workspace" data-mode={mode}>
        <section
          className="desk-zone ui-ornament"
          data-ornament="panel"
          data-zone="tray"
          data-collapsed={trayCollapsed ? "true" : "false"}
          aria-label="Tasks"
        >
          <div className="ui-ornament-content">
            <div className="desk-zone-toolbar">
              <h3 className="type-display-m">Tasks</h3>
              <Button
                type="button"
                variant="secondary"
                size="primary"
                ornament="dense"
                aria-expanded={!trayCollapsed}
                onClick={() => onTrayCollapsed(!trayCollapsed)}
              >
                {trayCollapsed ? "Expand tray" : "Collapse tray"}
              </Button>
            </div>
            <div className="desk-zone-body">
              <p className="type-body-m">Add a task to the tray.</p>
            </div>
          </div>
        </section>
        <section
          className="desk-zone desk-timeline ui-ornament"
          data-ornament="panel"
          data-zone="timeline"
          aria-label="Day"
        >
          <div className="ui-ornament-content">
            <h3 className="type-display-m">Day</h3>
            <p className="type-body-m">No blocks planned.</p>
          </div>
        </section>
        <section
          className="desk-zone ui-ornament"
          data-ornament="panel"
          data-zone="now"
          aria-label="Now"
        >
          <div className="ui-ornament-content">
            <h3 className="type-display-m">Now</h3>
            <p className="type-body-m">Nothing running.</p>
            <div data-primary-slot="daily-desk" />
          </div>
        </section>
      </div>
    </section>
  );
}
