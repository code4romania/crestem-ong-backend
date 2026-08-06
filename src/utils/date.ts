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
