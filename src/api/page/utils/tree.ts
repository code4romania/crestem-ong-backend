import { ancestorDocumentIds, MAX_PATH_DEPTH, pathSegments, type PageNode } from "./path";

/** A page as the parent checks need it: flat, with the parent's documentId. */
export interface PageRow {
  documentId: string;
  slug: string;
  parinte?: string | null;
}

/**
 * Links flat rows into walkable nodes. Validation reads the whole (small) page
 * table rather than populating relations, because a move has to be judged
 * against the moved page's descendants too, not just its ancestors.
 */
export function buildTree(rows: PageRow[]): Map<string, PageNode> {
  const nodes = new Map<string, PageNode>();
  for (const row of rows) {
    nodes.set(row.documentId, { documentId: row.documentId, slug: row.slug, parinte: null });
  }
  for (const row of rows) {
    const node = nodes.get(row.documentId)!;
    node.parinte = (row.parinte && nodes.get(row.parinte)) || null;
  }
  return nodes;
}

/** How many levels sit below a page. A page with no subpages returns 0. */
function depthBelow(pageId: string, rows: PageRow[]): number {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parinte) continue;
    children.set(row.parinte, [...(children.get(row.parinte) ?? []), row.documentId]);
  }

  // Iterative, and each page is visited once: stored data should never be
  // cyclic, but validation is the wrong place to trust that.
  let depth = 0;
  let level = children.get(pageId) ?? [];
  const seen = new Set<string>([pageId]);

  while (level.length) {
    depth += 1;
    const next: string[] = [];
    for (const id of level) {
      if (seen.has(id)) continue;
      seen.add(id);
      next.push(...(children.get(id) ?? []));
    }
    level = next;
  }

  return depth;
}

/**
 * Validates a page's parent. Returns a message to hand back to the editor, or
 * null when the move is allowed.
 *
 * `pageId` is null when creating: a page that does not exist yet has neither
 * ancestors to clash with nor subpages to carry.
 */
export function checkParent({
  pageId,
  parentId,
  rows,
}: {
  pageId: string | null;
  parentId: string | null;
  rows: PageRow[];
}): string | null {
  if (!parentId) return null;

  const parent = buildTree(rows).get(parentId);
  if (!parent) return "Pagina părinte nu există";

  if (pageId && (parentId === pageId || ancestorDocumentIds(parent).includes(pageId))) {
    return "O pagină nu poate fi propria subpagină";
  }

  const ownDepth = pathSegments(parent).length + 1;
  const carried = pageId ? depthBelow(pageId, rows) : 0;
  if (ownDepth + carried > MAX_PATH_DEPTH) {
    return `Calea paginii nu poate depăși ${MAX_PATH_DEPTH} niveluri`;
  }

  return null;
}

/**
 * The documentId of the page living at a path, or null. A page answers only at
 * its full path: `/social-change-accelerator` is a 404 once that page sits
 * under `/programe`, which keeps one page at exactly one URL.
 */
export function findByPath(rows: PageRow[], path: string): string | null {
  const wanted = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!wanted) return null;

  const nodes = buildTree(rows);
  for (const [documentId, node] of nodes) {
    if (pathSegments(node).join("/") === wanted) return documentId;
  }
  return null;
}
