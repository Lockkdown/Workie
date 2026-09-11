import { StatusIcon } from "./StatusIcon";
import type { SemanticState } from "./types";
import { statusSlug } from "./types";

type StatusMarkProps = {
  status: SemanticState;
};

export function StatusMark({ status }: StatusMarkProps) {
  const slug = statusSlug(status);
  return (
    <span className="ui-status-mark" data-status={slug}>
      <StatusIcon status={status} />
      <span className="ui-status-label type-body-s">{status}</span>
    </span>
  );
}
