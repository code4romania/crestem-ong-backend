/**
 * Returns true when a report/evaluation deadline is in the past.
 */
export const deadlineHasPassed = (
  deadline: string | Date | null | undefined
): boolean => {
  if (!deadline) {
    return false;
  }
  return new Date(deadline).getTime() < Date.now();
};
