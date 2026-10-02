import { canView, type ViewablePage } from "../../page/utils/visibility";

/** A page or article as the sitemap reads it: its URL, its last edit, its access rule. */
export interface SitemapSource extends ViewablePage {
  cale: string | null;
  actualizat: string;
}

export interface SitemapEntry {
  cale: string;
  actualizat: string;
}

/**
 * What an anonymous visitor could open, and nothing else. The sitemap is read by
 * crawlers, so the rule is always the anonymous one — never the caller's — and a
 * row without a URL (an article whose taxonomy is incomplete) has nowhere to
 * point a crawler at.
 */
export function publicEntries(rows: SitemapSource[]): SitemapEntry[] {
  return rows
    .filter((row): row is SitemapSource & { cale: string } => !!row.cale && canView(row, null))
    .map(({ cale, actualizat }) => ({ cale, actualizat }));
}
