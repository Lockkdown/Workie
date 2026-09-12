import type { PackedDay } from "../calendar/index";
import { writeTaskDrag } from "../desk/taskDrag";
import type { Task } from "../domain/types";
import { isLiveStatus } from "../domain/types";
import { Button } from "../ui/Button";
import { COPY } from "./copy";
import { formatHm } from "./format";

type TaskTrayListProps = {
  tasks: readonly Task[];
  packed: PackedDay;
  onOpenBoard: () => void;
  onCreateReserve: () => void;
  onScheduleTask: (taskId: string) => void;
};

export function nextTimeLabel(task: Task, packed: PackedDay): string {
  const blocks = packed.blocks.filter(
    (block) => block.kind === "task" && block.taskId === task.id,
  );
  const first = [...blocks].sort(
    (a, b) => a.derivedStartMs - b.derivedStartMs,
  )[0];
  if (!first) {
    return COPY.unscheduled;
  }
  return formatHm(first.derivedStartMs);
}

export function TaskTrayList({
  tasks,
  packed,
  onOpenBoard,
  onCreateReserve,
  onScheduleTask,
}: TaskTrayListProps) {
  const live = tasks.filter((task) => isLiveStatus(task.status));
  return (
    <div className="timeline-tray-list">
      <div className="timeline-actions">
        <Button
          type="button"
          variant="secondary"
          size="primary"
          onClick={onOpenBoard}
        >
          {COPY.openTaskBoard}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="primary"
          onClick={onCreateReserve}
        >
          {COPY.createReserve}
        </Button>
      </div>
      {live.map((task) => (
        <div
          key={task.id}
          className="timeline-tray-item"
          draggable
          onDragStart={(event) => {
            writeTaskDrag(event.dataTransfer, { taskId: task.id });
          }}
        >
          <p className="type-body-m">{task.title}</p>
          <p className="type-body-s">{nextTimeLabel(task, packed)}</p>
          <Button
            type="button"
            variant="secondary"
            size="primary"
            onClick={() => onScheduleTask(task.id)}
          >
            {COPY.scheduleOnTimeline}
          </Button>
        </div>
      ))}
    </div>
  );
}
