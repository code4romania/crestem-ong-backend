/**
 * A page's URL is not stored — it is derived by walking the `parinte` chain, so
 * renaming a slug or moving a branch never leaves a stale path behind. The
 * cost is that every caller must populate `parinte` deeply enough; the depth
 * cap in validation is what keeps that bounded.
 */
export interface PageNode {
  documentId?: string;
  slug: string;
  parinte?: PageNode | null;
}

/**
 * Walks upward, guarding against a cyclic chain. Validation refuses to create
 * one, but a walk that can hang the server is not something to leave to the
 * writer's good behaviour.
 */
function chain(page: PageNode): PageNode[] {
  const seen = new Set<PageNode>();
  const nodes: PageNode[] = [];

  let node: PageNode | null | undefined = page;
  while (node && !seen.has(node)) {
    seen.add(node);
    nodes.push(node);
    node = node.parinte;
  }

  return nodes;
}

/** Slugs from the root down: `["programe", "accelerator"]`. */
export function pathSegments(page: PageNode): string[] {
  return chain(page)
    .map((node) => node.slug)
    .reverse();
}

/** The page's URL path, leading slash included. */
export function pagePath(page: PageNode): string {
  return `/${pathSegments(page).join("/")}`;
}

/** Every ancestor's documentId, nearest first. The page itself is not included. */
export function ancestorDocumentIds(page: PageNode): string[] {
  return chain(page)
    .slice(1)
    .map((node) => node.documentId)
    .filter((id): id is string => typeof id === "string");
}

/**
 * How many segments a page's path may have. Nesting deeper than this is almost
 * always a sign the site's structure wants rethinking, and the cap is what
 * keeps the ancestor populate on the public read bounded.
 */
export const MAX_PATH_DEPTH = 4;
