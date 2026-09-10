/**
 * The rules behind the public category page's filter bar, kept pure so they can
 * be tested without a database and so the handler stays a read plus a filter.
 *
 * Everything is matched case-insensitively: `tip` is free text an editor typed,
 * and a visitor searching "ghid" means the same thing as "Ghid".
 */
export interface BrowseArticle {
  titlu: string;
  rezumat?: string | null;
  tip?: string | null;
  subcategorie?: { slug?: string; parinte?: { slug?: string } | null } | null;
}

export interface BrowseFilters {
  /** Category slug. Matches every article in any of its subcategories. */
  categorie: string | null;
  /** Subcategory slug. Matches only that subcategory's own articles. */
  subcategorie: string | null;
  tip: string | null;
  /** Free text, matched against the title and the summary. */
  q: string | null;
}

const fold = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export function matchesBrowse(article: BrowseArticle, filters: BrowseFilters): boolean {
  if (filters.categorie && fold(article.subcategorie?.parinte?.slug) !== fold(filters.categorie)) {
    return false;
  }

  if (filters.subcategorie && fold(article.subcategorie?.slug) !== fold(filters.subcategorie)) {
    return false;
  }

  if (filters.tip && fold(article.tip) !== fold(filters.tip)) return false;

  const q = fold(filters.q);
  if (q && !fold(article.titlu).includes(q) && !fold(article.rezumat).includes(q)) {
    return false;
  }

  return true;
}

/**
 * The `tip` values present, for the filter dropdown. Case-insensitively unique,
 * keeping the first spelling encountered so the dropdown shows "Ghid" rather
 * than whichever casing sorted first.
 */
export function distinctTipuri(articles: BrowseArticle[]): string[] {
  const seen = new Map<string, string>();

  for (const article of articles) {
    const tip = (article.tip ?? "").trim();
    if (!tip) continue;
    const key = tip.toLowerCase();
    if (!seen.has(key)) seen.set(key, tip);
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b, "ro"));
}

/**
 * Filtering and the type list in one place, because they disagree on purpose:
 * the articles are narrowed by every filter, while the dropdown lists the types
 * present in the CATEGORY — before `subcategorie`, `tip` and the search are
 * applied. Compute the list from the fully filtered set instead and choosing a
 * type empties the control that chose it, stranding the visitor with no way
 * back; scope it to the subcategory instead and the same stranding happens one
 * level over, when the chosen `tip` is absent from the chosen subcategory.
 */
export function browseArticles<T extends BrowseArticle>(
  articles: T[],
  filters: BrowseFilters,
): { matched: T[]; tipuri: string[] } {
  const inScope = articles.filter((article) =>
    matchesBrowse(article, { ...filters, subcategorie: null, tip: null, q: null }),
  );

  return {
    matched: articles.filter((article) => matchesBrowse(article, filters)),
    tipuri: distinctTipuri(inScope),
  };
}
