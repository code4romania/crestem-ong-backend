export interface ArticleReadRow {
  accessedAt: string;
  article: { documentId: string; titlu: string; tip: string | null; cale: string | null } | null;
}

export interface OrgArticleActivityRow {
  resourceTitle: string;
  type: string;
  accessedAt: string;
  totalAccesses: number;
  /** Null when the article's taxonomy relation is incomplete and it has no addressable URL. */
  cale: string | null;
}

/**
 * One row per distinct article read by anyone in the org: `totalAccesses` is
 * the number of members who have read it (each member contributes at most
 * one, since `article-read` already dedupes per user), and `accessedAt` is
 * the most recent of their timestamps.
 */
export function aggregateOrgLibraryActivity(reads: ArticleReadRow[]): OrgArticleActivityRow[] {
  const byArticle = new Map<string, OrgArticleActivityRow>();

  for (const read of reads) {
    if (!read.article) continue;
    const existing = byArticle.get(read.article.documentId);
    if (!existing) {
      byArticle.set(read.article.documentId, {
        resourceTitle: read.article.titlu,
        type: read.article.tip ?? "",
        accessedAt: read.accessedAt,
        totalAccesses: 1,
        cale: read.article.cale,
      });
      continue;
    }
    existing.totalAccesses += 1;
    if (read.accessedAt > existing.accessedAt) {
      existing.accessedAt = read.accessedAt;
    }
  }

  return [...byArticle.values()].sort((a, b) => b.accessedAt.localeCompare(a.accessedAt));
}
