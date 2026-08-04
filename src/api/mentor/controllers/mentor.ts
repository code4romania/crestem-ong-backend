import { Context } from "koa";

export default {
  async listActive(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const mentors = await strapi
      .documents("plugin::users-permissions.user")
      .findMany({
        filters: {
          role: { type: "mentor" },
          accountStatus: "active",
          blocked: false,
        },
        sort: { nume: "asc" },
      });
    return {
      data: mentors.map((mentor) => ({
        documentId: mentor.documentId,
        nume: mentor.nume,
        email: mentor.email,
      })),
    };
  },
};
