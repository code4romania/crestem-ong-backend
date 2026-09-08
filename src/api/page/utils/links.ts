/**
 * A CTA can point at another page instead of a typed URL. The reference is
 * stored as a documentId next to the href, and the public read resolves it into
 * the page's real path — so a link keeps working when its target is renamed or
 * moved under a different parent.
 *
 * The walk is deliberately shape-agnostic, like `collectFileIds`: the frontend
 * registry owns block shapes, and the backend only recognises the pair of keys
 * a link carries.
 */

/** A link is an object carrying both an `href` and a `pagina` reference. */
function linkTarget(node: Record<string, unknown>): string | null {
  if (typeof node.href !== "string" || typeof node.pagina !== "string") return null;
  return node.pagina.trim() || null;
}

function walk(node: unknown, visit: (link: Record<string, unknown>, pagina: string) => void) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (node === null || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const pagina = linkTarget(record);
  if (pagina) visit(record, pagina);

  Object.values(record).forEach((child) => walk(child, visit));
}

/** Every page referenced by a link inside the blocks, each listed once. */
export function collectPageLinkIds(blocks: unknown): string[] {
  const found = new Set<string>();
  walk(blocks, (_, pagina) => found.add(pagina));
  return [...found];
}

/**
 * Returns a copy of the blocks with every page-backed href replaced by the
 * resolved path. A reference with no entry in the map points at a page that is
 * gone, and its href is cleared rather than left stale — the blocks' own
 * "label and href go together" guards then drop the CTA from the render.
 */
export function applyPageLinks(blocks: unknown, paths: Record<string, string>): unknown {
  const copy = structuredClone(blocks);
  walk(copy, (link, pagina) => {
    link.href = paths[pagina] ?? "";
  });
  return copy;
}

/**
 * Pages a link asks this page to adopt. The editor ticks "put this page under
 * the current one" next to a CTA, and the save that follows moves the target
 * under this page — but only while the target is still top-level, so a page
 * deliberately filed elsewhere is never dragged back.
 */
export function collectChildRequests(blocks: unknown): string[] {
  const found = new Set<string>();
  walk(blocks, (link, pagina) => {
    if (link.subPagina === true) found.add(pagina);
  });
  return [...found];
}
