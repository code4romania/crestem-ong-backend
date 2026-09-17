import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { upsertArticleRead } from "../utils/upsert";
import { articlePath } from "../../article/utils/path";

const UID = "api::article-read.article-read";
const ARTICLE_UID = "api::article.article";

const readView = (row: any) => ({
  documentId: row.documentId,
  titlu: row.article?.titlu ?? "",
  tip: row.article?.tip ?? "",
  accessedAt: row.accessedAt,
  cale: row.article ? articlePath(row.article) : null,
});

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * Fire-and-forget from the article page: the visitor is reading the article
   * regardless of whether this call succeeds, so it only ever reports success
   * or a reason it couldn't record one, never a validation error surface.
   */
  async markRead(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const articleDocumentId = ctx.request.body?.articleDocumentId;
    if (typeof articleDocumentId !== "string" || !articleDocumentId) {
      return ctx.badRequest("articleDocumentId este obligatoriu");
    }

    const article = await strapi.documents(ARTICLE_UID).findOne({ documentId: articleDocumentId });
    if (!article) return ctx.notFound("Articolul nu există");

    await upsertArticleRead(strapi, ctx.state.user.documentId, articleDocumentId);

    return { data: true };
  },

  /**
   * This user's own reading history, most recently accessed first — the same
   * ordering the profile's "Articole citite din Bibliotecă" table shows.
   */
  async me(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const rows = (await strapi.documents(UID).findMany({
      filters: { user: { documentId: ctx.state.user.documentId } },
      populate: {
        article: {
          fields: ["titlu", "tip", "slug"],
          populate: { subcategorie: { populate: { parinte: true } } },
        },
      },
      sort: { accessedAt: "desc" },
      limit: -1,
    })) as any[];

    return { data: rows.map(readView) };
  },
}));
