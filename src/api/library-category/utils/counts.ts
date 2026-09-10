/**
 * How many of the given articles sit in each subcategory.
 *
 * The caller chooses the input, and that choice is the whole difference between
 * the two trees: the staff tree counts every article, drafts included, because
 * an unpublished article is still work a delete would destroy; the public tree
 * counts only what `canView` passed, because a card promising six resources
 * that leads to four is a broken promise.
 */
export interface CountableArticle {
  subcategorie?: { documentId?: string } | null;
}

export function countBySubcategoryId(articles: CountableArticle[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const article of articles) {
    const id = article.subcategorie?.documentId;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}
