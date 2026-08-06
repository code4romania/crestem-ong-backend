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
        populate: { avatar: true },
      });
    return {
      data: mentors.map((mentor) => ({
        documentId: mentor.documentId,
        nume: mentor.nume,
        email: mentor.email,
        mentorJobTitle: mentor.mentorJobTitle ?? null,
        mentorOrganization: mentor.mentorOrganization ?? null,
        avatar: mentor.avatar
          ? {
              documentId: mentor.avatar.documentId,
              name: mentor.avatar.name,
              url: mentor.avatar.url,
            }
          : null,
      })),
    };
  },
};
