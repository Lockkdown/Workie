/**
 * Task Board surface owned by T5. Daily Desk (T7) mounts it from the tray [D81].
 */
export type TaskBoardProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Labelled and keyboard equivalent of dragging a card onto the timeline.
   * T7 opens the schedule preview; T5 must not create a calendar block [D6] [D14] [D92].
   */
  onScheduleTask: (taskId: string) => void;
};

export const LOCAL_ACCOUNT_ID = "local";

export function localUserSource(): { kind: "user"; accountId: string } {
  return { kind: "user", accountId: LOCAL_ACCOUNT_ID };
}
