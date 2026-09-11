import { BlockTypeIcon } from "./StatusIcon";
import { StatusMark } from "./StatusMark";
import type { BlockType, OrnamentTier, TaskStatus } from "./types";

type TimeBlockProps = {
  status: TaskStatus;
  blockType: BlockType;
  title: string;
  ornament?: OrnamentTier;
  conflict?: boolean;
};

export function TimeBlock({
  status,
  blockType,
  title,
  ornament = "dense",
  conflict = false,
}: TimeBlockProps) {
  const typeLabel = blockType === "fixed" ? "Fixed" : "Flexible";
  const edge = blockType === "fixed" ? "solid" : "stepped-dashed";

  return (
    <article
      className="ui-time-block ui-ornament"
      data-ornament={ornament}
      data-block-type={blockType}
      data-edge={edge}
      data-conflict={conflict ? "true" : "false"}
    >
      <span className="ui-accent-strip" aria-hidden="true" />
      {conflict ? (
        <span className="ui-conflict-pattern" aria-hidden="true" />
      ) : null}
      <div className="ui-ornament-content ui-time-block-body">
        <p className="ui-time-block-title type-body-m">{title}</p>
        <div className="ui-time-block-meta">
          <StatusMark status={status} />
          <span
            className="ui-block-type type-body-s"
            data-block-type={blockType}
          >
            <BlockTypeIcon blockType={blockType} />
            <span>{typeLabel}</span>
          </span>
          {conflict ? <StatusMark status="Conflict" /> : null}
        </div>
      </div>
    </article>
  );
}
