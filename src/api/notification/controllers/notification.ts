import { factories } from "@strapi/strapi";
import { Context } from "koa";
import {
  listForUser,
  markAllRead,
  markRead,
  parsePaging,
  unreadCount,
} from "../utils/queries";
import { NOTIFICATION_UID } from "../utils/types";

export default factories.createCoreController(
  NOTIFICATION_UID,
  ({ strapi }) => ({
    async list(ctx: Context) {
      if (!ctx.state.user) return ctx.unauthorized();
      const paging = parsePaging(ctx.query as Record<string, unknown>);
      if (!paging) return ctx.badRequest("Parametri de paginare invalizi");
      return listForUser(strapi, ctx.state.user.id, paging);
    },

    async unreadCount(ctx: Context) {
      if (!ctx.state.user) return ctx.unauthorized();
      return { count: await unreadCount(strapi, ctx.state.user.id) };
    },

    async markRead(ctx: Context) {
      if (!ctx.state.user) return ctx.unauthorized();
      const data = await markRead(
        strapi,
        ctx.state.user.id,
        String(ctx.params.documentId),
      );
      // Same answer for "missing" and "someone else's": no id enumeration.
      if (!data) return ctx.notFound("Notificarea nu există");
      return { data };
    },

    async markAllRead(ctx: Context) {
      if (!ctx.state.user) return ctx.unauthorized();
      return { updated: await markAllRead(strapi, ctx.state.user.id) };
    },
  }),
);
