import { isLiveStatus, type Task } from "../domain/types";
import { Button } from "../ui/Button";
import { COPY } from "./copy";

export type DayClosePromptProps = {
  open: boolean;
  unfinished: readonly Task[];
  onCarry: (ids: readonly string[]) => void;
  onSkip: () => void;
};

export function DayClosePrompt({
  open,
  unfinished,
  onCarry,
  onSkip,
}: DayClosePromptProps) {
  if (!open) {
    return null;
  }
  const ids = unfinished
    .filter((task) => isLiveStatus(task.status))
    .map((task) => task.id);
  return (
    <div className="plan-item" role="status">
      <p className="type-body-m">{COPY.dayCloseTitle}</p>
      <p className="type-body-s">{COPY.dayCloseBody}</p>
      <ul>
        {unfinished.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
      <div className="plan-actions">
        <Button
          type="button"
          variant="secondary"
          size="primary"
          onClick={() => onCarry(ids)}
        >
          {COPY.carry}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="primary"
          onClick={onSkip}
        >
          {COPY.skipCarry}
        </Button>
      </div>
    </div>
  );
}
