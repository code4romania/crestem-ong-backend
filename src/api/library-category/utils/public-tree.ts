/**
 * The taxonomy as a visitor sees it. Two consumers share this: the
 * `/public/library-categories` endpoint, and the `biblioteca-categorii` block
 * injected into a public page read. One rule, so the block and the library
 * index can never disagree about which categories exist or how many resources
 * each holds.
 *
 * Two differences from the staff tree, both deliberate. Counts include only
 * articles the caller may actually open, because a card promising six resources
 * that leads to four is a broken promise. And anything empty — a subcategory,
 * then a category left with nothing — is omitted rather than offered as a dead
 * card or a filter option that returns nothing.
 */

import { canView } from "../../page/utils/visibility";
import { countBySubcategoryId } from "./counts";

export interface PublicSubcategory {
  documentId: string;
  nume: string;
  slug: string;
  descriere: string;
  numarArticole: number;
}

export interface PublicCategory extends PublicSubcategory {
  /** Rendered on the category card. Subcategories carry no icon. */
  icon: string;
  copii: PublicSubcategory[];
}

/**
 * The pure half: given every taxonomy row and the per-subcategory counts the
 * caller may see, build the visible tree. No database access — the caller does
 * the reads and the `canView` filtering first, which is what makes this
 * testable without one.
 */
export function buildPublicCategories(
  rows: any[],
  counts: Map<string, number>,
): PublicCategory[] {
  const children = new Map<string, any[]>();
  for (const row of rows) {
    const parentId = row.parinte?.documentId;
    if (!parentId) continue;
    children.set(parentId, [...(children.get(parentId) ?? []), row]);
  }

  return rows
    .filter((row) => !row.parinte)
    .map((row) => {
      const copii = (children.get(row.documentId) ?? [])
        .map((child) => ({
          documentId: child.documentId,
          nume: child.nume,
          slug: child.slug,
          descriere: child.descriere ?? "",
          numarArticole: counts.get(child.documentId) ?? 0,
        }))
        .filter((child) => child.numarArticole > 0);

      return {
        documentId: row.documentId,
        nume: row.nume,
        slug: row.slug,
        descriere: row.descriere ?? "",
        icon: row.icon ?? "folder",
        numarArticole: copii.reduce((total, child) => total + child.numarArticole, 0),
        copii,
      };
    })
    .filter((category) => category.numarArticole > 0);
}

/**
 * The impure half: the two reads plus the visibility filter, then the rule
 * above. `rows` arrives sorted by `nume`, so both levels come out alphabetical.
 */
export async function loadPublicCategories(
  strapi: any,
  roleType: string | null,
): Promise<PublicCategory[]> {
  const [rows, articles] = await Promise.all([
    strapi.documents("api::library-category.library-category").findMany({
      populate: { parinte: true },
      sort: { nume: "asc" },
      limit: -1,
    }) as Promise<any[]>,
    strapi.documents("api::article.article").findMany({
      fields: ["stare", "vizibilitate"],
      populate: { subcategorie: { fields: ["slug"] } },
      limit: -1,
    }) as Promise<any[]>,
  ]);

  const counts = countBySubcategoryId(articles.filter((article) => canView(article, roleType)));

  return buildPublicCategories(rows, counts);
}
