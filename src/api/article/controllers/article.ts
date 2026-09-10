/**
 * article controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { createArticleSchema, updateArticleSchema } from "../validation/article";
import { articlePath } from "../utils/path";
import { nextDataPublicarii } from "../utils/publish";
import { canView } from "../../page/utils/visibility";
import { collectFileIds } from "../../page/utils/media";
import { applyPageLinks, collectPageLinkIds } from "../../page/utils/links";
import { loadPageIndex } from "../../page/utils/page-index";
import { resolveCategoryBlocks } from "../../library-category/utils/blocks";
import { browseArticles } from "../utils/browse";

const UID = "api::article.article";
const CATEGORY_UID = "api::library-category.library-category";

/** Two levels of relation, which is exactly what `articlePath` needs. */
const POPULATE = { subcategorie: { populate: { parinte: true } } } as const;

const relationView = (row: any) =>
  row ? { documentId: row.documentId, nume: row.nume, slug: row.slug } : null;

/**
 * `publicat` is derived from `stare`, and `categorie` from the subcategory's
 * parent — neither is stored twice, so neither can drift out of step with the
 * row it came from.
 */
const listView = (article: any) => ({
  documentId: article.documentId,
  titlu: article.titlu,
  slug: article.slug,
  rezumat: article.rezumat ?? "",
  cale: articlePath(article),
  categorie: relationView(article.subcategorie?.parinte),
  subcategorie: relationView(article.subcategorie),
  autor: article.autor ?? "",
  etichete: article.etichete ?? [],
  tip: article.tip ?? "",
  publicat: article.stare === "publicat",
  vizibilitate: article.vizibilitate ?? [],
  dataPublicarii: article.dataPublicarii ?? null,
  actualizat: article.updatedAt,
});

const detailView = (article: any) => ({
  ...listView(article),
  blocuri: article.blocuri ?? [],
});

/**
 * An article attaches to a subcategory, never to a bare category: its path is
 * assembled from the subcategory *and* that subcategory's parent, so a
 * top-level target would produce an unaddressable article.
 */
async function checkSubcategory(strapi: any, documentId: string): Promise<string | null> {
  const target = await strapi.documents(CATEGORY_UID).findOne({
    documentId,
    populate: { parinte: true },
  });

  if (!target) return "Subcategoria nu există";
  if (!target.parinte) return "Articolul trebuie să fie într-o subcategorie, nu într-o categorie";
  return null;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  async list(ctx: Context) {
    const search = typeof ctx.query.search === "string" ? ctx.query.search.trim() : "";
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = 20;

    const filters = search
      ? {
          $or: [
            { titlu: { $containsi: search } },
            { rezumat: { $containsi: search } },
          ],
        }
      : {};

    const [articles, total] = await Promise.all([
      strapi.documents(UID).findMany({
        filters,
        populate: POPULATE,
        sort: { updatedAt: "desc" },
        limit: pageSize,
        start: (page - 1) * pageSize,
      }),
      strapi.documents(UID).count({ filters }),
    ]);

    return {
      data: (articles as any[]).map(listView),
      meta: {
        pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
      },
    };
  },

  /**
   * Every article, trimmed to what the article wizard's tag suggestions need.
   * Unpaginated on purpose: `list` is paginated at 20 for a screen the editor
   * scrolls, but a suggestion vocabulary drawn from only the 20 most recently
   * edited articles would quietly omit tags that plainly exist.
   *
   * Projected so `blocuri` is never fetched: it can run to ~1 MB per row and no
   * card needs it. Mirrors `publicList` and `grid.ts`'s
   * `resolveCategoryBlocks`.
   *
   * Sorted by `dataPublicarii` desc, matching the public read — the canvas has
   * to offer the same "cele mai recente" set the visitor will be shown, not the
   * most recently edited one.
   */
  async options() {
    const articles = (await strapi.documents(UID).findMany({
      // `stare` and `vizibilitate` ride along so the builder canvas can mark a
      // card the public will not get. Still no `blocuri`: a row runs to ~1 MB.
      fields: ["titlu", "slug", "rezumat", "etichete", "tip", "stare", "vizibilitate", "dataPublicarii"],
      populate: {
        subcategorie: {
          fields: ["slug"],
          populate: { parinte: { fields: ["nume", "slug"] } },
        },
      },
      sort: { dataPublicarii: "desc" },
      limit: -1,
    })) as any[];

    return {
      data: articles.map((article) => ({
        documentId: article.documentId,
        titlu: article.titlu,
        rezumat: article.rezumat ?? "",
        cale: articlePath(article),
        // The category's display name, matching the card shape the public read
        // injects via `grid.ts`'s `toCard`.
        categorie: article.subcategorie?.parinte?.nume ?? null,
        // Both ids, so the block's category filter can be applied on the canvas
        // without walking the taxonomy tree.
        categorieId: article.subcategorie?.parinte?.documentId ?? null,
        subcategorieId: article.subcategorie?.documentId ?? null,
        etichete: article.etichete ?? [],
        tip: article.tip ?? "",
        // What the builder needs to tell "the visitor will see this card" from
        // "only you will": the canvas shows drafts and restricted articles, but
        // marks them.
        stare: article.stare,
        vizibilitate: article.vizibilitate ?? [],
        dataPublicarii: article.dataPublicarii ?? null,
      })),
    };
  },

  async detail(ctx: Context) {
    const article = await strapi.documents(UID).findOne({
      documentId: ctx.params.documentId,
      populate: POPULATE,
    });
    if (!article) return ctx.notFound("Articolul nu există");

    return { data: detailView(article) };
  },

  async createOne(ctx: Context) {
    const parsed = createArticleSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const duplicate = await strapi.documents(UID).findFirst({
      filters: { slug: parsed.data.slug },
    });
    if (duplicate) return ctx.badRequest("Există deja un articol cu acest slug");

    const subcategoryError = await checkSubcategory(strapi, parsed.data.subcategorie);
    if (subcategoryError) return ctx.badRequest(subcategoryError);

    const { subcategorie, ...fields } = parsed.data;

    // A new article always starts as a draft; publishing it is a second call.
    const created = await strapi.documents(UID).create({
      data: {
        ...fields,
        subcategorie: { set: [subcategorie] },
        stare: "schita",
        dataPublicarii: null,
        fisiere: collectFileIds(fields.blocuri),
      } as any,
    });

    const reread = await strapi.documents(UID).findOne({
      documentId: created.documentId,
      populate: POPULATE,
    });

    return { data: detailView(reread) };
  },

  async updateOne(ctx: Context) {
    const parsed = updateArticleSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const existing = await strapi.documents(UID).findOne({
      documentId: ctx.params.documentId,
    });
    if (!existing) return ctx.notFound("Articolul nu există");

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const duplicate = await strapi.documents(UID).findFirst({
        filters: { slug: parsed.data.slug },
      });
      if (duplicate) return ctx.badRequest("Există deja un articol cu acest slug");
    }

    // `stare` is not part of the update payload — publishing and withdrawing go
    // through their own endpoints, so an edit never changes what the public can
    // see.
    const { subcategorie, ...fields } = parsed.data;
    const data: Record<string, unknown> = { ...fields };

    if (parsed.data.blocuri !== undefined) {
      data.fisiere = collectFileIds(parsed.data.blocuri);
    }

    if (subcategorie !== undefined) {
      const subcategoryError = await checkSubcategory(strapi, subcategorie);
      if (subcategoryError) return ctx.badRequest(subcategoryError);
      data.subcategorie = { set: [subcategorie] };
    }

    await strapi.documents(UID).update({
      documentId: ctx.params.documentId,
      data: data as any,
    });

    const reread = await strapi.documents(UID).findOne({
      documentId: ctx.params.documentId,
      populate: POPULATE,
    });

    return { data: detailView(reread) };
  },

  async deleteOne(ctx: Context) {
    const existing = await strapi.documents(UID).findOne({
      documentId: ctx.params.documentId,
    });
    if (!existing) return ctx.notFound("Articolul nu există");

    await strapi.documents(UID).delete({ documentId: ctx.params.documentId });

    return { data: { documentId: ctx.params.documentId } };
  },

  async publishOne(ctx: Context) {
    const existing = await strapi.documents(UID).findOne({
      documentId: ctx.params.documentId,
    });
    if (!existing) return ctx.notFound("Articolul nu există");

    await strapi.documents(UID).update({
      documentId: ctx.params.documentId,
      data: {
        stare: "publicat",
        dataPublicarii: nextDataPublicarii({
          stare: "publicat",
          current: (existing as any).dataPublicarii ?? null,
          now: new Date(),
        }),
      } as any,
    });

    return { data: { documentId: ctx.params.documentId, publicat: true } };
  },

  async unpublishOne(ctx: Context) {
    const existing = await strapi.documents(UID).findOne({
      documentId: ctx.params.documentId,
    });
    if (!existing) return ctx.notFound("Articolul nu există");

    // `dataPublicarii` is deliberately untouched: withdrawing an article does
    // not undo the fact that it was published on that date.
    await strapi.documents(UID).update({
      documentId: ctx.params.documentId,
      data: { stare: "schita" } as any,
    });

    return { data: { documentId: ctx.params.documentId, publicat: false } };
  },

  /**
   * The public browse read behind a category page. Visibility first, then the
   * filter bar, then paging — so the count a visitor sees is the count of what
   * they could actually open.
   */
  async publicList(ctx: Context) {
    const roleType = ctx.state.user?.role?.type ?? null;
    const requestedPage = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = 20;

    const filters = {
      categorie: typeof ctx.query.categorie === "string" ? ctx.query.categorie : null,
      subcategorie: typeof ctx.query.subcategorie === "string" ? ctx.query.subcategorie : null,
      tip: typeof ctx.query.tip === "string" ? ctx.query.tip : null,
      q: typeof ctx.query.q === "string" ? ctx.query.q : null,
    };

    const articles = (await strapi.documents(UID).findMany({
      fields: [
        "titlu",
        "slug",
        "rezumat",
        "autor",
        "tip",
        "etichete",
        "stare",
        "vizibilitate",
        "dataPublicarii",
        "updatedAt",
      ],
      populate: {
        subcategorie: {
          fields: ["nume", "slug"],
          populate: { parinte: { fields: ["nume", "slug"] } },
        },
      },
      sort: { dataPublicarii: "desc" },
      limit: -1,
    })) as any[];

    // Visibility first, so both the results and the type list describe only
    // what this caller could actually open.
    const visible = articles.filter((article) => canView(article, roleType));
    const { matched, tipuri } = browseArticles(visible, filters);
    const total = matched.length;
    const pageCount = Math.ceil(total / pageSize);

    // Clamped to the real page count, not just to 1: a bookmarked `?page=3`
    // survives its articles being unpublished, and would otherwise report a
    // non-zero `total` above an empty list and a pager pointing past the end.
    // An empty result set has `pageCount` 0, and must still read as page 1 so
    // the existing empty state renders.
    const page = Math.min(requestedPage, Math.max(1, pageCount));

    return {
      data: matched.slice((page - 1) * pageSize, page * pageSize).map(listView),
      meta: {
        pagination: { page, pageSize, total, pageCount },
        tipuri,
      },
    };
  },

  /**
   * One article by its full public path. Blocks are resolved the same two ways
   * `page.byPath` resolves a page's: CTA targets become real paths and are
   * cleared when the caller cannot open them, and grids are filled from the
   * same visibility-filtered article set. Without both passes a CTA inside an
   * article links into a 404 and can hint that a restricted page exists, and a
   * nested grid renders nothing.
   */
  async publicByPath(ctx: Context) {
    const requested = typeof ctx.query.path === "string" ? ctx.query.path : "";
    const roleType = ctx.state.user?.role?.type ?? null;

    const articles = (await strapi.documents(UID).findMany({
      fields: ["slug", "stare", "vizibilitate"],
      populate: {
        subcategorie: {
          fields: ["slug"],
          populate: { parinte: { fields: ["slug"] } },
        },
      },
      limit: -1,
    })) as any[];

    const visible = articles.filter((article) => canView(article, roleType));
    const match = visible.find((article) => articlePath(article) === requested);
    if (!match) return ctx.notFound("Articolul nu există");

    const full = await strapi.documents(UID).findOne({
      documentId: match.documentId,
      populate: POPULATE,
    });
    if (!full) return ctx.notFound("Articolul nu există");

    // Pass one: page-backed CTA hrefs, cleared for any target this caller
    // cannot view.
    const index = await loadPageIndex(strapi);
    const paths: Record<string, string> = {};
    for (const id of collectPageLinkIds((full as any).blocuri)) {
      const target = index.rowById(id);
      const targetPath = index.pathById(id);
      if (!target || !targetPath || !canView(target, roleType)) continue;
      paths[id] = targetPath;
    }
    const withLinks = applyPageLinks((full as any).blocuri, paths);

    // Pass two: any `biblioteca-categorii` block placed inside this article,
    // resolved through the very function the page read uses — so the two public
    // reads cannot drift apart on which categories a visitor may see.
    const blocuri = await resolveCategoryBlocks(strapi, withLinks, roleType);

    // A single object, matching `page.byPath`. The old `{ data: [one] }` shape
    // had no consumer, so it is corrected here rather than carried forward.
    return { data: { ...detailView(full), blocuri } };
  },
}));
