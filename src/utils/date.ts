export const toDateString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' });
  }
  return String(value).slice(0, 10);
};

export const toDisplayDate = (value: unknown): string => {
  const [year, month, day] = toDateString(value).split('-');
  return `${day}.${month}.${year}`;
};

export const todayInBucharest = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' });

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The Bucharest calendar day (`YYYY-MM-DD`) of a `date` or `datetime`
 * value, or null. Unlike `toDateString`, a datetime string is read as an
 * instant rather than sliced, so 22:30 UTC lands on the next local day.
 */
export const bucharestDay = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : toDateString(date);
};
