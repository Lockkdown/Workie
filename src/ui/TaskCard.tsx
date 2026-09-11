import { StatusMark } from "./StatusMark";
import { statusSlug, type OrnamentTier, type TaskStatus } from "./types";

type TaskCardProps = {
  status: TaskStatus;
  title: string;
  ornament?: OrnamentTier;
  conflict?: boolean;
};

export function TaskCard({
  status,
  title,
  ornament = "dense",
  conflict = false,
}: TaskCardProps) {
  return (
    <article
      className="ui-task-card ui-ornament"
      data-ornament={ornament}
      data-status={statusSlug(status)}
      data-conflict={conflict ? "true" : "false"}
    >
      <span className="ui-accent-strip" aria-hidden="true" />
      <div className="ui-ornament-content ui-task-card-body">
        <p className="ui-task-card-title type-body-m">{title}</p>
        <div className="ui-task-card-meta">
          <StatusMark status={status} />
          {conflict ? <StatusMark status="Conflict" /> : null}
        </div>
      </div>
    </article>
  );
}
