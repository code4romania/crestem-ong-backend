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

/** Minutes Bucharest is ahead of UTC at `instant`. */
const bucharestOffsetMinutes = (instant: Date): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Bucharest",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
};

/**
 * The instant a Bucharest calendar day (`YYYY-MM-DD`) begins, as an ISO
 * string. Romania changes clocks at 03:00/04:00, never at midnight, so the
 * offset read at UTC midnight of that date is the one local midnight has.
 */
export const bucharestDayStart = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, date);
  const offset = bucharestOffsetMinutes(new Date(utcMidnight));
  return new Date(utcMidnight - offset * 60_000).toISOString();
};

/** The calendar day after `day`, both `YYYY-MM-DD`. */
export const nextDay = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1))
    .toISOString()
    .slice(0, 10);
};
