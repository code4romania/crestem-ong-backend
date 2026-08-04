export type ProgramStatus = 'Upcoming' | 'Active' | 'Finished';

export const toDateString = (value: unknown): string => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

export const todayInBucharest = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' });

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
