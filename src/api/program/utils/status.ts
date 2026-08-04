import { toDateString, todayInBucharest } from '../../../utils/date';

export type ProgramStatus = 'Upcoming' | 'Active' | 'Finished';

export { toDateString, todayInBucharest };

export const computeProgramStatus = (
  startDate: string,
  endDate: string,
  today: string,
): ProgramStatus => {
  if (startDate > today) {
    return 'Upcoming';
  }
  if (endDate < today) {
    return 'Finished';
  }
  return 'Active';
};
