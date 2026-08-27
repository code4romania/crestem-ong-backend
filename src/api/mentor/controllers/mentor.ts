import { Context } from "koa";
import { updateMentorSchema } from "../../admin-user/validation/admin-user";

export default {
  async me(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const user = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: { id: ctx.state.user.id },
      populate: ["avatar"],
    });
    return {
      data: {
        nume: user.nume,
        email: user.email,
        createdAt: user.createdAt,
        bio: user.bio ?? null,
        dimensiuni: user.dimensiuni ?? [],
        ariiDeExpertiza: user.ariiDeExpertiza ?? [],
        avatar: user.avatar ? { id: user.avatar.id, url: user.avatar.url } : null,
      },
    };
  },

  async updateMe(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const parsed = await updateMentorSchema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    // `parsed.data` never contains `email` or `role` — the schema doesn't
    // define them, so a mentor can't use this to change either.
    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(ctx.state.user.id, parsed.data);

    return { message: "Profilul a fost actualizat cu succes." };
  },

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
