/**
 * library-category controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { createCategorySchema, updateCategorySchema } from "../validation/library-category";
import { checkParent, type CategoryRow } from "../utils/tree";
import { loadPublicCategories } from "../utils/public-tree";
import { countBySubcategoryId } from "../utils/counts";

const UID = "api::library-category.library-category";

/** Every row, unpaginated: the taxonomy is tens of records and every consumer wants all of it. */
async function loadRows(strapi: any) {
  const rows = await strapi.documents(UID).findMany({
    populate: { parinte: true },
    sort: { nume: "asc" },
    limit: -1,
  });

  return rows as any[];
}

function toCategoryRows(rows: any[]): CategoryRow[] {
  return rows.map((row) => ({
    documentId: row.documentId,
    parinte: row.parinte?.documentId ?? null,
  }));
}

/**
 * How many articles sit in each subcategory, drafts included — an unpublished
 * article is still work a delete would destroy. Counted in one grouped read
 * rather than one query per subcategory.
 */
async function countBySubcategory(strapi: any): Promise<Map<string, number>> {
  const articles = await strapi.documents("api::article.article").findMany({
    populate: { subcategorie: true },
    fields: ["documentId"],
    limit: -1,
  });

  return countBySubcategoryId(articles as any[]);
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * The whole tree in one response, both levels with their counts. A category's
   * count is the sum of its subcategories' — an article cannot attach to a bare
   * category, so a category has no articles of its own.
   */
  async tree() {
    const [rows, counts] = await Promise.all([loadRows(strapi), countBySubcategory(strapi)]);

    const children = new Map<string, any[]>();
    for (const row of rows) {
      const parentId = row.parinte?.documentId;
      if (!parentId) continue;
      children.set(parentId, [...(children.get(parentId) ?? []), row]);
    }

    const data = rows
      .filter((row) => !row.parinte)
      .map((row) => {
        const copii = (children.get(row.documentId) ?? []).map((child) => ({
          documentId: child.documentId,
          nume: child.nume,
          slug: child.slug,
          descriere: child.descriere ?? "",
          icon: child.icon ?? "folder",
          numarArticole: counts.get(child.documentId) ?? 0,
        }));

        return {
          documentId: row.documentId,
          nume: row.nume,
          slug: row.slug,
          descriere: row.descriere ?? "",
          icon: row.icon ?? "folder",
          numarArticole: copii.reduce((total, child) => total + child.numarArticole, 0),
          copii,
        };
      });

    return { data };
  },

  /**
   * The taxonomy as a visitor sees it. Two differences from `tree`, both
   * deliberate: counts include only articles this caller may actually open, and
   * a category with nothing visible in it is omitted entirely rather than
   * offered as an empty card.
   */
  async publicTree(ctx: Context) {
    const roleType = ctx.state.user?.role?.type ?? null;

    return { data: await loadPublicCategories(strapi, roleType) };
  },

  async createOne(ctx: Context) {
    const parsed = createCategorySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const rows = await loadRows(strapi);

    const duplicate = rows.find((row) => row.slug === parsed.data.slug);
    if (duplicate) return ctx.badRequest("Există deja o categorie cu acest slug");

    const parentError = checkParent({
      categoryId: null,
      parentId: parsed.data.parinte,
      rows: toCategoryRows(rows),
    });
    if (parentError) return ctx.badRequest(parentError);

    const created = await strapi.documents(UID).create({
      data: {
        nume: parsed.data.nume,
        slug: parsed.data.slug,
        parinte: parsed.data.parinte ? { set: [parsed.data.parinte] } : null,
        descriere: parsed.data.descriere,
        icon: parsed.data.icon,
      } as any,
    });

    return { data: { documentId: created.documentId } };
  },

  async updateOne(ctx: Context) {
    const parsed = updateCategorySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const rows = await loadRows(strapi);
    const existing = rows.find((row) => row.documentId === ctx.params.documentId);
    if (!existing) return ctx.notFound("Categoria nu există");

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      if (rows.some((row) => row.slug === parsed.data.slug)) {
        return ctx.badRequest("Există deja o categorie cu acest slug");
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.nume !== undefined) data.nume = parsed.data.nume;
    if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
    if (parsed.data.descriere !== undefined) data.descriere = parsed.data.descriere;
    if (parsed.data.icon !== undefined) data.icon = parsed.data.icon;

    // An absent `parinte` leaves the category where it is; an explicit null
    // promotes it back to the top level.
    if ("parinte" in parsed.data) {
      const parinte = parsed.data.parinte ?? null;
      const parentError = checkParent({
        categoryId: ctx.params.documentId,
        parentId: parinte,
        rows: toCategoryRows(rows),
      });
      if (parentError) return ctx.badRequest(parentError);

      data.parinte = parinte ? { set: [parinte] } : null;
    }

    await strapi.documents(UID).update({
      documentId: ctx.params.documentId,
      data: data as any,
    });

    return { data: { documentId: ctx.params.documentId } };
  },

  /**
   * Refused while non-empty, in both senses. Cascading would destroy editor
   * work silently; orphaning would leave articles with no resolvable URL, since
   * the public path is assembled from this relation. Moving the contents first
   * is one extra step and it is explicit.
   */
  async deleteOne(ctx: Context) {
    const rows = await loadRows(strapi);
    const existing = rows.find((row) => row.documentId === ctx.params.documentId);
    if (!existing) return ctx.notFound("Categoria nu există");

    const childCount = rows.filter(
      (row) => row.parinte?.documentId === ctx.params.documentId,
    ).length;
    if (childCount > 0) {
      return ctx.conflict(
        `Categoria are ${childCount} ${childCount === 1 ? "subcategorie" : "subcategorii"}. Șterge-le mai întâi.`,
      );
    }

    const counts = await countBySubcategory(strapi);
    const articleCount = counts.get(ctx.params.documentId) ?? 0;
    if (articleCount > 0) {
      return ctx.conflict(
        `Subcategoria are ${articleCount} ${articleCount === 1 ? "articol" : "articole"}. Mută-le sau șterge-le mai întâi.`,
      );
    }

    await strapi.documents(UID).delete({ documentId: ctx.params.documentId });

    return { data: { documentId: ctx.params.documentId } };
  },
}));
