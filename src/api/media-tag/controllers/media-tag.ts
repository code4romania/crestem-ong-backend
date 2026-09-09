import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { createMediaTagSchema } from "../validation/media-tag";
import { slugify } from "../utils/slug";

const view = (row: any) => ({
  id: row.id,
  documentId: row.documentId,
  nume: row.nume,
  // `slug` is a Strapi `uid` field, which the document service does not fill on
  // create — older rows may have `null`. Fall back to a derived slug so the
  // frontend key/filter never sees a null.
  slug: row.slug || slugify(row.nume),
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

      const slug = slugify(parsed.data.nume);
      if (!slug) {
        return ctx.badRequest("Numele etichetei trebuie să conțină litere sau cifre");
      }

      const duplicate = await strapi.documents("api::media-tag.media-tag").findFirst({
        filters: {
          $or: [{ nume: { $eqi: parsed.data.nume } }, { slug }],
        },
      });
      if (duplicate) return ctx.conflict("Există deja o etichetă cu acest nume");

      const created = await strapi.documents("api::media-tag.media-tag").create({
        data: { nume: parsed.data.nume, slug } as any,
      });
      return { data: view(created) };
    },
  }),
);
