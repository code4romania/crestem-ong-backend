import { loadPageIndex } from "../../page/utils/page-index";
import { articlePath } from "../../article/utils/path";
import { publicEntries } from "../utils/entries";

export default {
  /**
   * Every page and library article an anonymous visitor can open, as URL and
   * last edit — the frontend's `sitemap.xml` is built from this. Paths come
   * from the page index, the same derivation `/public/pages` answers by.
   */
  async list() {
    const index = await loadPageIndex(strapi);
    const [pages, articles] = await Promise.all([
      strapi.documents("api::page.page").findMany({
        fields: ["updatedAt"],
        limit: -1,
      }),
      strapi.documents("api::article.article").findMany({
        fields: ["slug", "stare", "vizibilitate", "updatedAt"],
        populate: {
          subcategorie: {
            fields: ["slug"],
            populate: { parinte: { fields: ["slug"] } },
          },
        },
        limit: -1,
      }),
    ]);

    const pageRows = (pages as any[]).flatMap((page) => {
      const row = index.rowById(page.documentId);
      if (!row) return [];
      return [
        {
          cale: index.pathById(page.documentId),
          actualizat: page.updatedAt,
          stare: row.stare,
          vizibilitate: row.vizibilitate,
        },
      ];
    });

    const articleRows = (articles as any[]).map((article) => ({
      cale: articlePath(article),
      actualizat: article.updatedAt,
      stare: article.stare,
      vizibilitate: article.vizibilitate,
    }));

    return {
      data: {
        pagini: publicEntries(pageRows),
        articole: publicEntries(articleRows),
      },
    };
  },
};
