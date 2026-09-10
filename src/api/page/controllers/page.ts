/**
 * page controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { createPageSchema, updatePageSchema } from "../validation/page";
import { canView } from "../utils/visibility";
import { collectFileIds } from "../utils/media";
import { mediaUrlWithVersion } from "../../../utils/media";
import { applyResolvedMedia, type ResolvedFile } from "../utils/media-resolve";
import { applyPageLinks, collectChildRequests, collectPageLinkIds } from "../utils/links";
import { loadPageIndex, type PageIndex } from "../utils/page-index";
import { checkParent, findByPath } from "../utils/tree";

/**
 * Swap every block file reference for the file's current url/name/alt. Kept
 * next to `applyPageLinks` in the read path: the stored block JSON is a
 * write-time snapshot, this makes the served page reflect the live file.
 */
async function resolveBlocksMedia(strapi: any, blocuri: unknown): Promise<unknown> {
  const ids = collectFileIds(blocuri);
  if (ids.length === 0) return blocuri ?? [];

  const rows = await strapi.db.query("plugin::upload.file").findMany({
    where: { id: { $in: ids } },
    select: ["id", "url", "name", "alternativeText", "updatedAt"],
  });

  const byId = new Map<number, ResolvedFile>(
    rows.map((r: any) => [
      r.id,
      {
        // Cache-bust on replace: the file row keeps its URL, so a stale image
        // would otherwise stay on the page and in the builder until CDN expiry.
        url: mediaUrlWithVersion(r.url, r.updatedAt),
        name: r.name ?? "",
        alternativeText: r.alternativeText ?? null,
      },
    ]),
  );

  return applyResolvedMedia(blocuri, byId);
}

/**
 * `publicat` is derived, not stored: the API keeps the boolean it has always
 * returned, while the row carries the `stare` enum that replaced Strapi's
 * draft & publish. `cale` is derived too — the page's full path, ancestors
 * included.
 */
const listView = (page: any, index: PageIndex) => ({
  documentId: page.documentId,
  titlu: page.titlu,
  slug: page.slug,
  cale: index.pathOf(page),
  parinte: index.parentOf(page.documentId),
  publicat: page.stare === "publicat",
  vizibilitate: page.vizibilitate ?? [],
  actualizat: page.updatedAt,
});

const detailView = (page: any, index: PageIndex, blocuri?: unknown) => ({
  ...listView(page, index),
  blocuri: blocuri ?? page.blocuri ?? [],
});

/**
 * Applies the "put this page under the current one" ticks a page's buttons
 * carry: each linked page that is still top-level moves under this one, so its
 * address becomes `/aceasta-pagina/tinta` everywhere at once.
 *
 * A target that already has a parent is left alone — someone filed it there on
 * purpose, and a save here must not drag it back. A move the tree rules refuse
 * (a cycle, or one segment too deep) is logged and skipped rather than failing
 * the save: the page's own content was already written.
 */
async function adoptRequestedChildren(strapi: any, hostId: string, blocuri: unknown) {
  const requested = collectChildRequests(blocuri);
  if (requested.length === 0) return;

  let index = await loadPageIndex(strapi);
  for (const targetId of requested) {
    if (targetId === hostId) continue;

    const target = index.rowById(targetId);
    if (!target || target.parinte) continue;

    const error = checkParent({ pageId: targetId, parentId: hostId, rows: index.rows });
    if (error) {
      strapi.log.warn(`[page] Nu am mutat ${targetId} sub ${hostId}: ${error}`);
      continue;
    }

    await strapi.documents("api::page.page").update({
      documentId: targetId,
      data: { parinte: { set: [hostId] } } as any,
    });

    // Every following check has to see the tree as it now stands.
    index = await loadPageIndex(strapi);
  }
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

    const [pages, total, index] = await Promise.all([
      strapi.documents("api::page.page").findMany({
        filters,
        sort: { updatedAt: "desc" },
        limit: pageSize,
        start: (page - 1) * pageSize,
      }),
      strapi.documents("api::page.page").count({ filters }),
      loadPageIndex(strapi),
    ]);

    return {
      data: pages.map((entry: any) => listView(entry, index)),
      meta: {
        pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
      },
    };
  },

  /**
   * Every page, trimmed to what a picker needs. Unpaginated on purpose: the
   * menu editor has to offer all of them at once, and a site's page count stays
   * in the hundreds at most.
   */
  async options() {
    const [pages, index] = await Promise.all([
      strapi.documents("api::page.page").findMany({ sort: { titlu: "asc" }, limit: -1 }),
      loadPageIndex(strapi),
    ]);

    return {
      data: pages.map((entry: any) => ({
        documentId: entry.documentId,
        titlu: entry.titlu,
        slug: entry.slug,
        cale: index.pathOf(entry),
        parinte: index.parentOf(entry.documentId),
        publicat: entry.stare === "publicat",
      })),
    };
  },

  async detail(ctx: Context) {
    const [page, index] = await Promise.all([
      strapi.documents("api::page.page").findOne({ documentId: ctx.params.documentId }),
      loadPageIndex(strapi),
    ]);
    if (!page) return ctx.notFound("Pagina nu există");

    const blocuri = await resolveBlocksMedia(strapi, page.blocuri);
    return { data: detailView(page, index, blocuri) };
  },

  async createOne(ctx: Context) {
    const parsed = createPageSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const duplicate = await strapi.documents("api::page.page").findFirst({
      filters: { slug: parsed.data.slug },
    });
    if (duplicate) return ctx.badRequest("Există deja o pagină cu acest slug");

    const { parinte = null, ...fields } = parsed.data;
    const before = await loadPageIndex(strapi);
    const parentError = checkParent({ pageId: null, parentId: parinte, rows: before.rows });
    if (parentError) return ctx.badRequest(parentError);

    // A new page always starts as a draft; publishing it is a second call.
    const created = await strapi.documents("api::page.page").create({
      data: {
        ...fields,
        parinte: parinte ? { set: [parinte] } : null,
        stare: "schita",
        fisiere: collectFileIds(fields.blocuri),
      } as any,
    });

    await adoptRequestedChildren(strapi, created.documentId, fields.blocuri);

    const blocuri = await resolveBlocksMedia(strapi, created.blocuri);
    return { data: detailView(created, await loadPageIndex(strapi), blocuri) };
  },

  async updateOne(ctx: Context) {
    const parsed = updatePageSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const existing = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
    });
    if (!existing) return ctx.notFound("Pagina nu există");

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const duplicate = await strapi.documents("api::page.page").findFirst({
        filters: { slug: parsed.data.slug },
      });
      if (duplicate) return ctx.badRequest("Există deja o pagină cu acest slug");
    }

    // `stare` is not part of the update payload — publishing and withdrawing
    // go through their own endpoints, so an edit never changes what the public
    // can see.
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.blocuri) {
      data.fisiere = collectFileIds(parsed.data.blocuri);
    }

    // An absent `parinte` leaves the page where it is; an explicit null moves
    // it back to the top level.
    if ("parinte" in parsed.data) {
      const parinte = parsed.data.parinte ?? null;
      const before = await loadPageIndex(strapi);
      const parentError = checkParent({
        pageId: ctx.params.documentId,
        parentId: parinte,
        rows: before.rows,
      });
      if (parentError) return ctx.badRequest(parentError);

      data.parinte = parinte ? { set: [parinte] } : null;
    }

    const updated = await strapi.documents("api::page.page").update({
      documentId: ctx.params.documentId,
      data: data as any,
    });

    await adoptRequestedChildren(
      strapi,
      ctx.params.documentId,
      parsed.data.blocuri ?? updated.blocuri,
    );

    const blocuri = await resolveBlocksMedia(strapi, updated.blocuri);
    return { data: detailView(updated, await loadPageIndex(strapi), blocuri) };
  },

  async deleteOne(ctx: Context) {
    const existing = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
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
    });
    if (!existing) return ctx.notFound("Pagina nu există");

    await strapi.documents("api::page.page").update({
      documentId: ctx.params.documentId,
      data: { stare: "publicat" } as any,
    });

    return { data: { documentId: ctx.params.documentId, publicat: true } };
  },

  async unpublishOne(ctx: Context) {
    const existing = await strapi.documents("api::page.page").findOne({
      documentId: ctx.params.documentId,
    });
    if (!existing) return ctx.notFound("Pagina nu există");

    await strapi.documents("api::page.page").update({
      documentId: ctx.params.documentId,
      data: { stare: "schita" } as any,
    });

    return { data: { documentId: ctx.params.documentId, publicat: false } };
  },

  /**
   * The public read, addressed by full path. A page the requester may not see
   * returns 404 rather than 403 — a restricted page should not confirm its own
   * existence — and so does a page asked for at anything but its own path,
   * which is what keeps one page at exactly one URL.
   */
  async byPath(ctx: Context) {
    const requested = typeof ctx.query.path === "string" ? ctx.query.path : "";
    const roleType = ctx.state.user?.role?.type ?? null;
    const index = await loadPageIndex(strapi);

    const documentId = findByPath(index.rows, requested);
    if (!documentId) return ctx.notFound("Pagina nu există");

    const page = await strapi.documents("api::page.page").findOne({ documentId });
    if (!page || !canView(page as any, roleType)) {
      return ctx.notFound("Pagina nu există");
    }

    // A CTA pointing at a page this visitor cannot open would be a link into a
    // 404, so an unreachable target resolves to nothing and the block's own
    // "label and href go together" guard drops the button.
    const paths: Record<string, string> = {};
    for (const id of collectPageLinkIds(page.blocuri)) {
      const target = index.rowById(id);
      const targetPath = index.pathById(id);
      if (!target || !targetPath || !canView(target, roleType)) continue;
      paths[id] = targetPath;
    }

    const withMedia = await resolveBlocksMedia(strapi, page.blocuri);
    return { data: detailView(page, index, applyPageLinks(withMedia, paths)) };
  },
}));
