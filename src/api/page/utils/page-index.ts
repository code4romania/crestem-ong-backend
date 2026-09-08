import { pagePath, type PageNode } from "./path";
import { buildTree, type PageRow } from "./tree";
import type { PageStare } from "./visibility";

/** A row of the page table, with the bits every path decision needs. */
export interface IndexRow extends PageRow {
  stare?: PageStare | null;
  vizibilitate?: string[] | null;
}

/**
 * Paths are derived from the `parinte` chain rather than stored, so anything
 * that reports a URL first loads the (small) page table and links it into a
 * tree. One query then answers a page's own path, its parent, and the paths of
 * every other page it links to — which is why menus resolve their items through
 * the same index rather than populating relations several levels deep.
 */
export async function loadPageIndex(strapi: any) {
  const pages = await strapi.documents("api::page.page").findMany({
    fields: ["slug", "stare", "vizibilitate"],
    populate: { parinte: { fields: ["slug"] } },
    limit: -1,
  });

  const rows: IndexRow[] = pages.map((entry: any) => ({
    documentId: entry.documentId,
    slug: entry.slug,
    parinte: entry.parinte?.documentId ?? null,
    stare: entry.stare,
    vizibilitate: entry.vizibilitate,
  }));

  const nodes = buildTree(rows);
  const node = (documentId: string): PageNode | undefined => nodes.get(documentId);
  const byId = new Map(rows.map((row) => [row.documentId, row]));

  return {
    rows,
    nodes,
    /** A page's full path. Falls back to its slug if the row is not indexed yet. */
    pathOf: (page: { documentId: string; slug: string }) => {
      const found = node(page.documentId);
      return found ? pagePath(found) : `/${page.slug}`;
    },
    /** The full path of a page known only by id, or null when it is gone. */
    pathById: (documentId: string) => {
      const found = node(documentId);
      return found ? pagePath(found) : null;
    },
    rowById: (documentId: string) => byId.get(documentId) ?? null,
    parentOf: (documentId: string) => node(documentId)?.parinte?.documentId ?? null,
  };
}

export type PageIndex = Awaited<ReturnType<typeof loadPageIndex>>;
