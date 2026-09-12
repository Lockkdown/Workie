import { BlockTypeIcon } from "../ui/StatusIcon";
import { StatusMark } from "../ui/StatusMark";
import type { BlockType } from "../ui/types";
import { COPY } from "./copy";

type ReserveChromeProps = {
  blockType: BlockType;
  conflict?: boolean;
  title?: string;
  reserve?: boolean;
};

export function ReserveChrome({
  blockType,
  conflict = false,
  title = COPY.reserve,
  reserve = true,
}: ReserveChromeProps) {
  const typeLabel = blockType === "fixed" ? COPY.fixed : COPY.flexible;
  const edge = blockType === "fixed" ? "solid" : "stepped-dashed";
  return (
    <article
      className="ui-time-block ui-ornament"
      data-ornament="dense"
      data-block-type={blockType}
      data-edge={edge}
      data-conflict={conflict ? "true" : "false"}
      data-reserve={reserve ? "true" : "false"}
    >
      <span className="ui-accent-strip" aria-hidden="true" />
      {conflict ? (
        <span className="ui-conflict-pattern" aria-hidden="true" />
      ) : null}
      <div className="ui-ornament-content ui-time-block-body">
        <p className="ui-time-block-title type-body-m">{title}</p>
        <div className="ui-time-block-meta">
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
