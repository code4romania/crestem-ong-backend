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
