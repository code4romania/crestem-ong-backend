import { USER_UID } from "./types";

/**
 * Active = `accountStatus: "active"` and not blocked. `blocked` may be NULL on
 * legacy-imported users (no DB default), so NULL counts as not blocked; `$ne`
 * would drop those rows. The clause is an `$or`, so callers needing another
 * `$or` combine them via `$and`.
 */
export const ACTIVE_NOT_BLOCKED = {
  $or: [{ blocked: false }, { blocked: { $null: true } }],
};
const ACTIVE = { accountStatus: "active", ...ACTIVE_NOT_BLOCKED };

const activeUsers = (strapi: any, roles: string[]): Promise<any[]> =>
  strapi.documents(USER_UID).findMany({
    filters: {
      role: { type: { $in: roles } },
      ...ACTIVE,
    },
    fields: ["id"],
    limit: -1,
  });

const ids = (rows: any[]): number[] => rows.map((row) => row.id);

/** User ids of every active Admin FDSC. */
export const fdscAdmins = async (strapi: any): Promise<number[]> =>
  ids(await activeUsers(strapi, ["super-admin"]));

/** User ids of every active Admin FDSC and Editor FDSC. */
export const fdscStaff = async (strapi: any): Promise<number[]> =>
  ids(await activeUsers(strapi, ["super-admin", "editor-fdsc"]));

/**
 * User ids of the `ngo-admin` of each given ONG. A number is read as an ONG
 * `id`, a string as its `documentId`, so callers pass whichever they hold.
 */
export const ongAdmins = async (
  strapi: any,
  ongs: Array<number | string>,
): Promise<number[]> => {
  const ongIds = ongs.filter((ong): ong is number => typeof ong === "number");
  const ongDocumentIds = ongs.filter(
    (ong): ong is string => typeof ong === "string",
  );
  const match = [
    ...(ongIds.length ? [{ ong: { id: { $in: ongIds } } }] : []),
    ...(ongDocumentIds.length
      ? [{ ong: { documentId: { $in: ongDocumentIds } } }]
      : []),
  ];
  if (match.length === 0) {
    return [];
  }
  const rows = await strapi.documents(USER_UID).findMany({
    filters: {
      role: { type: "ngo-admin" },
      accountStatus: "active",
      $and: [ACTIVE_NOT_BLOCKED, { $or: match }],
    },
    fields: ["id"],
    limit: -1,
  });
  return ids(rows);
};

/** The subset of the given user ids that are active (not pending, not blocked). */
export const activeAmong = async (
  strapi: any,
  userIds: number[],
): Promise<number[]> => {
  if (userIds.length === 0) {
    return [];
  }
  const rows = await strapi.documents(USER_UID).findMany({
    filters: { id: { $in: userIds }, ...ACTIVE },
    fields: ["id"],
    limit: -1,
  });
  return ids(rows);
};
