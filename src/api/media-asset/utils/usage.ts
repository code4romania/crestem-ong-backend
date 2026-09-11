import { loadPageIndex } from "../../page/utils/page-index";

export interface PageUsage {
  documentId: string;
  titlu: string;
  cale: string;
}

/**
 * Pages that reference `fileId` through the real `fisiere` media relation —
 * which the page controller keeps in sync with block JSON on every save via
 * `collectFileIds`. One query plus the (small) page index for full paths; no
 * block scanning here.
 */
export async function findPagesUsingFile(
  strapi: any,
  fileId: number,
): Promise<PageUsage[]> {
  const [pages, index] = await Promise.all([
    strapi.documents("api::page.page").findMany({
      filters: { fisiere: { id: { $in: [fileId] } } },
      fields: ["slug", "titlu"],
      limit: -1,
    }),
    loadPageIndex(strapi),
  ]);

  return pages.map((page: any) => ({
    documentId: page.documentId,
    titlu: page.titlu,
    cale: index.pathOf(page),
  }));
}

/**
 * The list screen needs a usage count for every card at once. This is the batch
 * form of `findPagesUsingFile`: one page query and one page index for the whole
 * set, grouped into a `fileId -> pages` map. Files used by no page are simply
 * absent from the map. An empty input runs no queries.
 */
export async function findPagesUsingFiles(
  strapi: any,
  fileIds: number[],
): Promise<Map<number, PageUsage[]>> {
  const byFile = new Map<number, PageUsage[]>();
  if (fileIds.length === 0) return byFile;

  const [pages, index] = await Promise.all([
    strapi.documents("api::page.page").findMany({
      filters: { fisiere: { id: { $in: fileIds } } },
      fields: ["slug", "titlu"],
      populate: { fisiere: { fields: ["id"] } },
      limit: -1,
    }),
    loadPageIndex(strapi),
  ]);

  const wanted = new Set(fileIds);
  for (const page of pages) {
    const usage: PageUsage = {
      documentId: page.documentId,
      titlu: page.titlu,
      cale: index.pathOf(page),
    };
    for (const file of page.fisiere ?? []) {
      if (!wanted.has(file.id)) continue;
      const existing = byFile.get(file.id);
      if (existing) existing.push(usage);
      else byFile.set(file.id, [usage]);
    }
  }

  return byFile;
}
