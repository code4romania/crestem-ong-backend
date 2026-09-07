import type { Core } from "@strapi/strapi";

interface SeedItem {
  label: string;
  url?: string;
  children?: { label: string; url: string }[];
}

interface SeedMenu {
  location: "header" | "footer";
  name: string;
  items: SeedItem[];
}

/**
 * The two menus the public site renders. Seeded so every environment has them
 * from the first boot — the API exposes no create route, and a missing menu
 * would leave the site with no navigation at all.
 *
 * Contents mirror what the frontend hardcodes today in
 * `components/features/navigation/nav-data.ts` and the footer design, so
 * switching the site over to these rows changes nothing visible.
 */
const MENUS: SeedMenu[] = [
  {
    location: "header",
    name: "Main Navigation",
    items: [
      {
        // No url: this entry only opens the dropdown today, exactly as
        // `DespreDropdown` renders it.
        label: "Despre noi",
        children: [
          { label: "Despre noi", url: "/despre" },
          { label: "Echipă", url: "/echipa" },
          { label: "Susținători", url: "/sustinatori" },
        ],
      },
      { label: "Biblioteca", url: "/biblioteca" },
      { label: "Programe", url: "/programe" },
      { label: "LexiXplore", url: "/lexixplore" },
      { label: "Evaluare ONG", url: "/evaluare-ong" },
      { label: "Persoane resursă", url: "/mentori" },
      { label: "Contact", url: "/contact" },
    ],
  },
  {
    location: "footer",
    name: "Footer Menu",
    // Each parent is a column heading and carries no url; its children are the
    // links under it.
    items: [
      {
        label: "Platformă",
        children: [
          { label: "Despre noi", url: "/despre" },
          { label: "Biblioteca", url: "/biblioteca" },
          { label: "Programe", url: "/programe" },
          { label: "Contact", url: "/contact" },
        ],
      },
      {
        label: "Instrumente",
        children: [
          { label: "LexiXplore", url: "/lexixplore" },
          { label: "Evaluare ONG", url: "/evaluare-ong" },
          { label: "Podcast", url: "/podcast" },
        ],
      },
      {
        label: "Legal",
        children: [
          { label: "Termeni și condiții", url: "/termeni-si-conditii" },
          { label: "Politica de confidențialitate", url: "/politica-de-confidentialitate" },
          { label: "Cookie-uri", url: "/cookie-uri" },
        ],
      },
    ],
  },
];

/**
 * Creates a menu only when its location is absent. An existing menu is left
 * alone — its items are the editor's, and a redeploy must never overwrite them.
 */
export async function seedMenus(strapi: Core.Strapi) {
  for (const menu of MENUS) {
    const existing = await strapi
      .documents("api::menu.menu")
      .findFirst({ filters: { location: menu.location } });

    if (existing) continue;

    // The Document Service, not `strapi.db.query`: the query engine treats
    // `items` as a relation and expects ids, while components have to be built
    // from the objects themselves.
    await strapi.documents("api::menu.menu").create({ data: menu as any });
    strapi.log.info(`[bootstrap] Created menu "${menu.name}".`);
  }
}
