/**
 * Reading the query string of the FDSC list screens. Koa hands every value back
 * as `string | string[] | undefined`, and the multi-select filters send their
 * selection as one comma-separated key.
 */

export const textParam = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const csvParam = (value: unknown): string[] => {
  const parts = Array.isArray(value)
    ? value.flatMap((entry) => String(entry).split(","))
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(parts.map((part) => part.trim()).filter(Boolean))];
};

export const pageParam = (value: unknown): number => {
  const parsed = Number(textParam(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};
