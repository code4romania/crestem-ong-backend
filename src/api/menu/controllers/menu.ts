/**
 * menu controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { MENU_LOCATIONS, MenuLocation, menuItemsSchema } from "../validation/menu-items";

const POPULATE = { items: { populate: { children: true } } } as const;

const menuView = (menu: any) => ({
  documentId: menu.documentId,
  location: menu.location,
  name: menu.name,
  items: (menu.items ?? []).map((item: any) => ({
    label: item.label,
    // Absent rather than null: a footer column heading has no address at all,
    // and the frontend distinguishes "no link" from "empty link".
    ...(item.url ? { url: item.url } : {}),
    children: (item.children ?? []).map((child: any) => ({
      label: child.label,
      url: child.url,
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

    return { data: sorted.map(menuView) };
  },

  async detail(ctx: Context) {
    const location = readLocation(ctx);
    if (!location) return ctx.badRequest("Meniul cerut nu există");

    const menu = await strapi.documents("api::menu.menu").findFirst({
      filters: { location },
      populate: POPULATE,
    });
    if (!menu) return ctx.notFound("Meniul cerut nu există");

    return { data: menuView(menu) };
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

    const updated = await strapi.documents("api::menu.menu").update({
      documentId: menu.documentId,
      data: { items: parsed.data } as any,
      populate: POPULATE,
    });

    return { data: menuView(updated) };
  },
}));
