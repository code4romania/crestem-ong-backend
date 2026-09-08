import { z } from "zod";

export const MENU_LOCATIONS = ["header", "footer"] as const;

export type MenuLocation = (typeof MENU_LOCATIONS)[number];

const label = z
  .string({ message: "Eticheta este obligatorie" })
  .trim()
  .min(1, "Eticheta este obligatorie");

/**
 * The documentId of a CMS page. A menu entry names a page and nothing else — no
 * hand-written addresses — so an entry's address is derived from that page's
 * slug at read time and renaming the page follows through to every menu
 * pointing at it.
 */
const pagina = z
  .string({ message: "Pagina este obligatorie" })
  .trim()
  .min(1, "Pagina este obligatorie");

/**
 * Second-level items declare no `children`, so the strict object rejects a third
 * level. Depth is a schema rule here and in `menu.sub-item`, not a UI courtesy.
 */
const subItem = z.strictObject({ label, pagina: pagina.optional() });

/**
 * `pagina` is optional at every level, and deliberately so. The whole tree is
 * saved in one request, so requiring it would make a menu holding one unfinished
 * entry impossible to save at all — including impossible to fix, since the fix
 * is itself a save. The editor requires a page when adding or editing an entry;
 * an entry that ends up without one is simply skipped by the public renderer.
 */
const headerItem = z.strictObject({
  label,
  pagina: pagina.optional(),
  children: z.array(subItem).optional(),
});

/**
 * Footer parents are column headings — they name a group and never redirect, so
 * `pagina` is not part of their shape and a submitted one is refused.
 */
const footerItem = z.strictObject({
  label,
  children: z.array(subItem).optional(),
});

export function menuItemsSchema(location: MenuLocation) {
  return z.array(location === "footer" ? footerItem : headerItem);
}
