import { useId, type ReactNode } from "react";
import type { OrnamentTier } from "./types";

type PanelProps = {
  title: string;
  children: ReactNode;
  ornament?: OrnamentTier;
  role?: "dialog";
};

export function Panel({
  title,
  children,
  ornament = "panel",
  role,
}: PanelProps) {
  const titleId = useId();
  const isDialog = role === "dialog";
  const titleClass = isDialog ? "type-body-l" : "type-display-l";

  return (
    <section
      className="ui-panel ui-ornament"
      data-ornament={ornament}
      data-kind={isDialog ? "dialog" : "panel"}
      role={role}
      aria-labelledby={titleId}
      aria-modal={isDialog ? true : undefined}
    >
      <div className="ui-ornament-content">
        <h2 id={titleId} className={titleClass}>
          {title}
        </h2>
        <div className="ui-panel-body type-body-m">{children}</div>
      </div>
    </section>
  );
}
