import { StatusMark } from "./StatusMark";
import { statusSlug, type OrnamentTier, type TaskStatus } from "./types";

export const CONTRIBUTION_LEVELS = [0, 1, 2, 3, "4+"] as const;
export type ContributionLevel = (typeof CONTRIBUTION_LEVELS)[number];

type ProgressStatusProps = {
  status: TaskStatus;
  value?: number;
  ornament?: OrnamentTier;
  conflict?: boolean;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function ProgressStatus({
  status,
  value = 0,
  ornament = "dense",
  conflict = false,
}: ProgressStatusProps) {
  const percent = clampPercent(value);
  return (
    <div className="ui-progress-status ui-ornament" data-ornament={ornament}>
      <div className="ui-ornament-content">
        <div className="ui-progress-status-meta">
          <StatusMark status={status} />
          {conflict ? <StatusMark status="Conflict" /> : null}
          <span className="type-numeric type-body-s">{percent}%</span>
        </div>
        <div
          className="ui-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Progress"
        >
          <span
            className="ui-progress-fill"
            style={{ width: `${percent}%` }}
            data-status={statusSlug(status)}
          />
        </div>
      </div>
    </div>
  );
}

export function ContributionSwatch({ level }: { level: ContributionLevel }) {
  const key = level === "4+" ? "4plus" : String(level);
  const label = level === "4+" ? "4+" : String(level);
  return (
    <span className="ui-contribution" data-level={key}>
      <span className="ui-contribution-swatch" aria-hidden="true" />
      <span className="ui-contribution-label type-body-s">{label}</span>
    </span>
  );
}

export function ContributionLegend() {
  return (
    <div className="ui-contribution-legend">
      <p className="type-body-s">Legend</p>
      <div className="ui-contribution-row">
        {CONTRIBUTION_LEVELS.map((level) => (
          <ContributionSwatch key={String(level)} level={level} />
        ))}
      </div>
    </div>
  );
}
