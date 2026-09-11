/** At most one unfinished Pomodoro cycle may exist app-wide [D40]. */
export function atMostOneUnfinishedCycle(unfinishedCount: number): boolean {
  if (!Number.isInteger(unfinishedCount) || unfinishedCount < 0) {
    return false;
  }
  return unfinishedCount <= 1;
}
