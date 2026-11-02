import { NOTIFICATION_UID, type NotificationView } from "./types";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export const notificationView = (row: any): NotificationView => ({
  documentId: row.documentId,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link ?? null,
  readAt: row.readAt ?? null,
  createdAt: row.createdAt,
});

const parseInteger = (value: unknown): number | null => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  return Number(value);
};

/** `null` when `start`/`limit` are present but not valid (`limit` is clamped to MAX_LIMIT). */
export function parsePaging(
  query: Record<string, unknown>,
): { start: number; limit: number } | null {
  const start = query.start === undefined ? 0 : parseInteger(query.start);
  const rawLimit =
    query.limit === undefined ? DEFAULT_LIMIT : parseInteger(query.limit);
  if (start === null || rawLimit === null || rawLimit < 1) return null;
  return { start, limit: Math.min(rawLimit, MAX_LIMIT) };
}

/** Newest first; one extra row is read to know whether another page exists. */
export async function listForUser(
  strapi: any,
  userId: number,
  { start, limit }: { start: number; limit: number },
) {
  const rows: any[] = await strapi.documents(NOTIFICATION_UID).findMany({
    filters: { recipient: { id: userId } },
    sort: [{ createdAt: "desc" }, { id: "desc" }],
    start,
    limit: limit + 1,
  });
  return {
    data: rows.slice(0, limit).map(notificationView),
    meta: { start, limit, hasMore: rows.length > limit },
  };
}

export const unreadCount = (strapi: any, userId: number): Promise<number> =>
  strapi.documents(NOTIFICATION_UID).count({
    filters: { recipient: { id: userId }, readAt: { $null: true } },
  });

/** Idempotent. `null` when the notification does not exist or is not the user's. */
export async function markRead(
  strapi: any,
  userId: number,
  documentId: string,
): Promise<NotificationView | null> {
  const row = await strapi.documents(NOTIFICATION_UID).findFirst({
    filters: { documentId, recipient: { id: userId } },
  });
  if (!row) return null;
  if (row.readAt) return notificationView(row);
  const updated = await strapi.documents(NOTIFICATION_UID).update({
    documentId,
    data: { readAt: new Date().toISOString() } as any,
  });
  return notificationView(updated);
}

/** Marks only the caller's unread rows; returns how many changed. */
export async function markAllRead(
  strapi: any,
  userId: number,
): Promise<number> {
  const query = strapi.db.query(NOTIFICATION_UID);
  const unread: Array<{ id: number }> = await query.findMany({
    select: ["id"],
    where: { recipient: { id: userId }, readAt: null },
  });
  if (unread.length === 0) return 0;
  const result = await query.updateMany({
    where: { id: { $in: unread.map((row) => row.id) } },
    data: { readAt: new Date() },
  });
  return result?.count ?? unread.length;
}
