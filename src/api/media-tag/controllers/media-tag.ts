import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { createMediaTagSchema } from "../validation/media-tag";

const view = (row: any) => ({
  id: row.id,
  documentId: row.documentId,
  nume: row.nume,
  slug: row.slug,
});

export default factories.createCoreController(
  "api::media-tag.media-tag",
  ({ strapi }) => ({
    async list() {
      const tags = await strapi
        .documents("api::media-tag.media-tag")
        .findMany({ sort: { nume: "asc" }, limit: -1 });
      return { data: tags.map(view) };
    },

    async createOne(ctx: Context) {
      const parsed = createMediaTagSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const duplicate = await strapi.documents("api::media-tag.media-tag").findFirst({
        filters: { nume: { $eqi: parsed.data.nume } },
      });
      if (duplicate) return ctx.conflict("Există deja o etichetă cu acest nume");

      const created = await strapi.documents("api::media-tag.media-tag").create({
        data: { nume: parsed.data.nume } as any,
      });
      return { data: view(created) };
    },
  }),
);
