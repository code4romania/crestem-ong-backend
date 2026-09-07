import { z } from "zod";

export const MENU_LOCATIONS = ["header", "footer"] as const;

export type MenuLocation = (typeof MENU_LOCATIONS)[number];

const label = z
  .string({ message: "Eticheta este obligatorie" })
  .trim()
  .min(1, "Eticheta este obligatorie");

/**
 * A menu link is either an internal path (`/despre`) or an absolute address.
 * A bare `despre` would render an href relative to whatever page the visitor is
 * on, which is never what the editor meant.
 */
const url = z
  .string({ message: "Adresa este obligatorie" })
  .trim()
  .min(1, "Adresa este obligatorie")
  .regex(
    /^(\/|https?:\/\/)/,
    "Adresa trebuie să înceapă cu „/” sau cu http:// ori https://",
  );

/**
 * Second-level items declare no `children`, so the strict object rejects a third
 * level. Depth is a schema rule here and in `menu.sub-item`, not a UI courtesy.
 */
const subItem = z.strictObject({ label, url });

/**
 * A header parent that carries children only opens a dropdown — "Despre noi" has
 * never been a link. One without children has nowhere to send the visitor unless
 * it names an address, so there `url` is required.
 */
const headerItem = z
  .strictObject({
    label,
    url: url.optional(),
    children: z.array(subItem).optional(),
  })
  .refine((item) => Boolean(item.url) || (item.children?.length ?? 0) > 0, {
    message: "Adresa este obligatorie pentru un element fără sub-elemente",
    path: ["url"],
  });

/**
 * Footer parents are column headings — they name a group and never redirect, so
 * `url` is not part of their shape and a submitted one is refused.
 */
const footerItem = z.strictObject({
  label,
  children: z.array(subItem).optional(),
});

export function menuItemsSchema(location: MenuLocation) {
  return z.array(location === "footer" ? footerItem : headerItem);
}
