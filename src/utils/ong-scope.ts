import { Context } from "koa";

export const loadUserWithOngs = async (
  strapi: any,
  userDocumentId: string,
): Promise<any> =>
  strapi.documents("plugin::users-permissions.user").findOne({
    documentId: userDocumentId,
    populate: { ong: true },
  });

export const userOngs = (user: any): any[] =>
  ((user?.ong ?? []) as any[]).filter(Boolean);

export const belongsToOng = (user: any, ongDocumentId: string) =>
  userOngs(user).some((ong) => ong.documentId === ongDocumentId);

/** Whether `mentorDocumentId` has an `ngo-mentor` row linking them to this ong. */
export const mentorHasOng = async (
  strapi: any,
  mentorDocumentId: string,
  ongDocumentId: string,
): Promise<boolean> => {
  const rows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
    filters: {
      mentors: { documentId: mentorDocumentId },
      ong: { documentId: ongDocumentId },
    },
    limit: 1,
  });
  return rows.length > 0;
};

export const resolveActingOng = (
  user: any,
  requested?: string,
): { ong: any } | { error: string } => {
  const ongs = userOngs(user);
  if (ongs.length === 0) {
    return { error: "Utilizatorul nu aparține unei organizații" };
  }
  if (requested) {
    const match = ongs.find((ong) => ong.documentId === requested);
    if (!match) {
      return { error: "Nu ai acces la această organizație" };
    }
    return { ong: match };
  }
  if (ongs.length > 1) {
    return {
      error:
        "Selectează organizația pentru care faci această acțiune (parametrul ong)",
    };
  }
  return { ong: ongs[0] };
};

export const requestedOng = (ctx: Context): string | undefined => {
  const fromQuery = (ctx.query as any)?.ong;
  const fromBody = (ctx.request?.body as any)?.ong;
  const value = fromQuery ?? fromBody;
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

export const getOngAdminNames = async (
  strapi: any,
  ongDocumentIds: string[],
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  if (ongDocumentIds.length === 0) {
    return map;
  }
  const admins = await strapi
    .documents("plugin::users-permissions.user")
    .findMany({
      filters: {
        role: { type: "ngo-admin" },
        ong: { documentId: { $in: ongDocumentIds } },
      },
      populate: { ong: true },
    });
  for (const admin of admins as any[]) {
    for (const ong of (admin.ong ?? []) as any[]) {
      if (ong?.documentId && !map.has(ong.documentId)) {
        map.set(ong.documentId, admin.nume);
      }
    }
  }
  return map;
};

export const requireOng = async (
  strapi: any,
  ctx: Context,
): Promise<{ ong: any; user: any } | { error: string }> => {
  const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
  const resolved = resolveActingOng(user, requestedOng(ctx));
  if ("error" in resolved) {
    return resolved;
  }
  return { ong: resolved.ong, user };
};
