/**
 * A `biblioteca-categorii` block stores no selection — it always shows every
 * category with something publicly visible in it. The public read fills the
 * cards in and injects them, so the renderer stays a plain synchronous
 * component: it is the same component on the public page and on the builder's
 * client-side canvas, and one of those cannot await anything.
 *
 * Injection happens on the public read only. The editor's own read never
 * carries `categoriiRezolvate`, so a save can never write it back into storage.
 *
 * Because every block on a page shows the same list, one read serves all of
 * them and there is nothing to key by block id — unlike the per-block requests
 * the article grid this replaced had to collect.
 */

import { loadPublicCategories, type PublicCategory } from "./public-tree";

/** One card, as the renderer needs it. A subcategory's icon is never shown. */
export interface ResolvedCategory {
  documentId: string;
  nume: string;
  slug: string;
  descriere: string;
  icon: string;
  numarArticole: number;
}

const BLOCK_TYPE = "article-grid";

function walk(node: unknown, visit: (block: Record<string, unknown>) => void) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (node === null || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  if (record.type === BLOCK_TYPE) visit(record);

  Object.values(record).forEach((child) => walk(child, visit));
}

/** Whether the tree carries any such block, so an ordinary page costs no read. */
export function hasCategoryBlock(blocks: unknown): boolean {
  let found = false;
  walk(blocks, () => {
    found = true;
  });
  return found;
}

function toCard(category: PublicCategory): ResolvedCategory {
  return {
    documentId: category.documentId,
    nume: category.nume,
    slug: category.slug,
    descriere: category.descriere,
    icon: category.icon,
    numarArticole: category.numarArticole,
  };
}

/**
 * A copy of the blocks with every category block's cards filled in. A block
 * always gets a list — empty when the library has nothing published — rather
 * than a missing field, so the renderer has one shape to handle instead of two.
 */
export function applyCategoryBlocks(
  blocks: unknown,
  categories: ResolvedCategory[],
): unknown {
  const copy = structuredClone(blocks);
  walk(copy, (block) => {
    const data = (block.data ?? {}) as Record<string, unknown>;
    data.categoriiRezolvate = categories;
    block.data = data;
  });
  return copy;
}

/**
 * The whole pass for a public read: skip entirely when the tree holds no such
 * block, otherwise resolve the visible taxonomy once and inject it everywhere.
 *
 * Shared by `page.byPath` and `article.publicByPath` so one visibility rule
 * governs both — two copies of a `canView`-filtered read is how two public
 * reads drift apart.
 */
export async function resolveCategoryBlocks(
  strapi: any,
  blocuri: unknown,
  roleType: string | null,
): Promise<unknown> {
  if (!hasCategoryBlock(blocuri)) return blocuri;

  const categories = await loadPublicCategories(strapi, roleType);
  return applyCategoryBlocks(blocuri, categories.map(toCard));
}
