/**
 * An article's URL is not stored — it is derived from the subcategory and that
 * subcategory's parent, so renaming either slug never leaves a stale path
 * behind. The cost is that every caller must populate the relation two levels
 * deep; `null` is the honest answer when they have not, rather than a path with
 * `undefined` in it.
 */
export interface ArticleNode {
  slug: string;
  subcategorie?: { slug?: string; parinte?: { slug?: string } | null } | null;
}

export function articlePath(article: ArticleNode): string | null {
  const subSlug = article.subcategorie?.slug;
  const categorySlug = article.subcategorie?.parinte?.slug;
  if (!article.slug || !subSlug || !categorySlug) return null;

  return `/biblioteca/${categorySlug}/${subSlug}/${article.slug}`;
}
