/**
 * page controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { createPageSchema, updatePageSchema } from "../validation/page";
import { canView } from "../utils/visibility";
import { collectFileIds } from "../utils/media";

/**
 * `publicat` cannot come from the row itself: with draft & publish, the draft
 * version always carries `publishedAt: null`, whether or not a published
 * version of the same document exists. It is passed in by the caller, which
 * knows which documentIds have one.
 */
const listView = (page: any, publicat: boolean) => ({
  documentId: page.documentId,
  titlu: page.titlu,
  slug: page.slug,
  publicat,
  vizibilitate: page.vizibilitate ?? [],
  actualizat: page.updatedAt,
});

const detailView = (page: any, publicat: boolean) => ({
  ...listView(page, publicat),
  blocuri: page.blocuri ?? [],
});

/** documentIds that currently have a published version. */
async function publishedIds(strapi: any, documentIds: string[]): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set();

  const published = await strapi.documents("api::page.page").findMany({
    filters: { documentId: { $in: documentIds } },
    status: "published",
    limit: -1,
  });

  return new Set(published.map((entry: any) => entry.documentId));
}

async function isPublished(strapi: any, documentId: string): Promise<boolean> {
  const published = await strapi.documents("api::page.page").findOne({
    documentId,
    status: "published",
  });
  return Boolean(published);
}

export default factories.createCoreController("api::page.page", ({ strapi }) => ({
  async list(ctx: Context) {
    const search = typeof ctx.query.search === "string" ? ctx.query.search.trim() : "";
    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = 20;

    const filters = search
      ? {
          $or: [
            { titlu: { $containsi: search } },
            { slug: { $containsi: search } },
          ],
        }
      : {};

    // `status: "draft"` returns each document's working version, published or
    // not — the list has to show drafts, which the default published-only read
    // would hide entirely.
    const [pages, total] = await Promise.all([
      strapi.documents("api::page.page").findMany({
        filters,
        status: "draft",
        sort: { updatedAt: "desc" },
        limit: pageSize,
        start: (page - 1) * pageSize,
      }),
      strapi.documents("api::page.page").count({ filters, status: "draft" }),
    ]);

    const published = await publishedIds(
      strapi,
      pages.map((entry) => entry.documentId),
    );

    return {
      data: pages.map((entry) => listView(entry, published.has(entry.documentId))),
      meta: {
        pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
      },
    };
  },

  async detail(ctx: Context) {
    const page = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
      status: "draft",
    });
    if (!page) return ctx.notFound("Pagina nu există");

    return { data: detailView(page, await isPublished(strapi, page.documentId)) };
  },

  async createOne(ctx: Context) {
    const parsed = createPageSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const duplicate = await strapi.documents("api::page.page").findFirst({
      filters: { slug: parsed.data.slug },
      status: "draft",
    });
    if (duplicate) return ctx.badRequest("Există deja o pagină cu acest slug");

    const created = await strapi.documents("api::page.page").create({
      data: {
        ...parsed.data,
        fisiere: collectFileIds(parsed.data.blocuri),
      } as any,
    });

    return { data: detailView(created, false) };
  },

  async updateOne(ctx: Context) {
    const parsed = updatePageSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const existing = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
      status: "draft",
    });
    if (!existing) return ctx.notFound("Pagina nu există");

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const duplicate = await strapi.documents("api::page.page").findFirst({
        filters: { slug: parsed.data.slug },
        status: "draft",
      });
      if (duplicate) return ctx.badRequest("Există deja o pagină cu acest slug");
    }

    // The update itself never changes publish state — captured before writing
    // so a page that was already live gets republished after, instead of
    // leaving its published row stuck on the pre-edit content.
    const wasPublished = await isPublished(strapi, existing.documentId);

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.blocuri) {
      data.fisiere = collectFileIds(parsed.data.blocuri);
    }

    const updated = await strapi.documents("api::page.page").update({
      documentId: ctx.params.documentId,
      data: data as any,
    });

    if (wasPublished) {
      await strapi.documents("api::page.page").publish({
        documentId: ctx.params.documentId,
      });
    }

    return {
      data: detailView(updated, wasPublished),
    };
  },

  async deleteOne(ctx: Context) {
    const existing = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
      status: "draft",
    });
    if (!existing) return ctx.notFound("Pagina nu există");

    await strapi.documents("api::page.page").delete({
      documentId: ctx.params.documentId,
    });

    return { data: { documentId: ctx.params.documentId } };
  },

  async publishOne(ctx: Context) {
    const existing = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
      status: "draft",
    });
    if (!existing) return ctx.notFound("Pagina nu există");

    const published = await strapi.documents("api::page.page").publish({
      documentId: ctx.params.documentId,
    });

    return { data: { documentId: ctx.params.documentId, publicat: Boolean(published) } };
  },

  async unpublishOne(ctx: Context) {
    const existing = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
      status: "draft",
    });
    if (!existing) return ctx.notFound("Pagina nu există");

    await strapi.documents("api::page.page").unpublish({
      documentId: ctx.params.documentId,
    });

    return { data: { documentId: ctx.params.documentId, publicat: false } };
  },

  /**
   * The public read. A page the requester may not see returns 404 rather than
   * 403 — a restricted page should not confirm its own existence.
   */
  async bySlug(ctx: Context) {
    const slug = ctx.params.slug;
    const roleType = ctx.state.user?.role?.type ?? null;

    // The published version first — that is what a visitor should see, and its
    // `publishedAt` is what `canView` reads. Only when there is none does the
    // draft matter, and then only for staff, which `canView` decides.
    const published = await strapi.documents("api::page.page").findFirst({
      filters: { slug },
      status: "published",
    });

    const page =
      published ??
      (await strapi.documents("api::page.page").findFirst({
        filters: { slug },
        status: "draft",
      }));

    if (!page || !canView(page as any, roleType)) {
      return ctx.notFound("Pagina nu există");
    }

    return { data: detailView(page, Boolean(published)) };
  },
}));
