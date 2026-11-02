/** Date and time pieces for notification bodies: Europe/Bucharest, `5 nov. 2026` / `10:00`. */

const toDate = (value: Date | string | number): Date =>
  value instanceof Date ? value : new Date(value);

const DATE_FORMAT = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const TIME_FORMAT = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const formatRoDate = (value: Date | string | number): string =>
  DATE_FORMAT.format(toDate(value));

export const formatRoTime = (value: Date | string | number): string =>
  TIME_FORMAT.format(toDate(value));
