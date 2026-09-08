/**
 * menu controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { MENU_LOCATIONS, MenuLocation, menuItemsSchema } from "../validation/menu-items";
import { loadPageIndex, type PageIndex } from "../../page/utils/page-index";

const POPULATE = {
  items: { populate: { pagina: true, children: { populate: { pagina: true } } } },
} as const;

/**
 * An item's address comes from the page it points at, resolved at read time, so
 * renaming a page — or moving it under a different parent, which changes its
 * whole path — follows through to every menu. A hand-written `url` is used only
 * when there is no page.
 *
 * An item with neither is not a mistake in every case — a footer column heading
 * deliberately has no address — but it is also what a deleted page leaves
 * behind, since the relation goes null. The editor shows that state; the public
 * renderer skips it.
 */
const linkView = (entry: any, index: PageIndex) => {
  if (entry.pagina) {
    return {
      url: index.pathById(entry.pagina.documentId) ?? `/${entry.pagina.slug}`,
      pagina: entry.pagina.documentId,
    };
  }
  return entry.url ? { url: entry.url } : {};
};

const menuView = (menu: any, index: PageIndex) => ({
  documentId: menu.documentId,
  location: menu.location,
  name: menu.name,
  items: (menu.items ?? []).map((item: any) => ({
    label: item.label,
    ...linkView(item, index),
    children: (item.children ?? []).map((child: any) => ({
      label: child.label,
      ...linkView(child, index),
    })),
  })),
});

const readLocation = (ctx: Context): MenuLocation | null => {
  const location = ctx.params.location;
  return MENU_LOCATIONS.includes(location) ? (location as MenuLocation) : null;
};

export default factories.createCoreController("api::menu.menu", ({ strapi }) => ({
  async list() {
    const menus = await strapi.documents("api::menu.menu").findMany({
      populate: POPULATE,
      limit: -1,
    });

    // `location` is an enum column, so its natural order is the enum's, not the
    // reading order the editor expects. Sort by the declared list instead.
    const sorted = [...menus].sort(
      (a, b) =>
        MENU_LOCATIONS.indexOf(a.location as MenuLocation) -
        MENU_LOCATIONS.indexOf(b.location as MenuLocation),
    );

    const index = await loadPageIndex(strapi);
    return { data: sorted.map((menu: any) => menuView(menu, index)) };
  },

  async detail(ctx: Context) {
    const location = readLocation(ctx);
    if (!location) return ctx.badRequest("Meniul cerut nu există");

    const menu = await strapi.documents("api::menu.menu").findFirst({
      filters: { location },
      populate: POPULATE,
    });
    if (!menu) return ctx.notFound("Meniul cerut nu există");

    return { data: menuView(menu, await loadPageIndex(strapi)) };
  },

  /**
   * Replaces the menu's whole item tree. Items are components, so they carry no
   * stable identifier between saves — there is nothing for a per-item endpoint
   * to address. Sending the full tree also makes reordering and re-nesting a
   * single atomic write.
   */
  async updateItems(ctx: Context) {
    const location = readLocation(ctx);
    if (!location) return ctx.badRequest("Meniul cerut nu există");

    const parsed = menuItemsSchema(location).safeParse(ctx.request.body?.items);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const menu = await strapi.documents("api::menu.menu").findFirst({
      filters: { location },
    });
    if (!menu) return ctx.notFound("Meniul cerut nu există");

    // `set` with the page's documentId, rather than the bare string the payload
    // carries: the shorthand is easy to get wrong for a relation nested inside a
    // component, and a silently ignored relation looks exactly like an item the
    // editor never filled in.
    const withRelations = parsed.data.map((item: any) => ({
      label: item.label,
      pagina: item.pagina ? { set: [item.pagina] } : null,
      children: (item.children ?? []).map((child: any) => ({
        label: child.label,
        pagina: child.pagina ? { set: [child.pagina] } : null,
      })),
    }));

    const updated = await strapi.documents("api::menu.menu").update({
      documentId: menu.documentId,
      data: { items: withRelations } as any,
      populate: POPULATE,
    });

    return { data: menuView(updated, await loadPageIndex(strapi)) };
  },
}));
