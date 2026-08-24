import { Context } from "koa";
import { todayInBucharest } from "../../../utils/date";
import { requireOng } from "../../../utils/ong-scope";
import { buildFdscDashboard } from "../utils/fdsc";
import { buildOngDashboard } from "../utils/ong";
import { buildMentorDashboard } from "../utils/mentor";

export default {
  async fdsc(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    return { data: await buildFdscDashboard(strapi, todayInBucharest()) };
  },

  async ong(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    // Same scoping as `/ongs/me`: the optional `?ong=` parameter picks the
    // organization when the admin runs more than one.
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    return {
      data: await buildOngDashboard(
        strapi,
        scope.ong.documentId,
        todayInBucharest(),
      ),
    };
  },

  async mentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    return {
      data: await buildMentorDashboard(
        strapi,
        ctx.state.user.documentId,
        todayInBucharest(),
      ),
    };
  },
};
