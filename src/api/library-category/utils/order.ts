/**
 * Top-level categories mirror the self-assessment matrix's dimensions 1:1, so
 * the public library shows them in that order rather than alphabetically.
 * `DIMENSIONS` is the single source of that order; its `key` uses underscores
 * where a category's auto-generated slug uses hyphens.
 */
import { DIMENSIONS } from "../../../constants/dimensions";

const CATEGORY_ORDER = DIMENSIONS.map((dimension) => dimension.key.replace(/_/g, "-"));

/**
 * A category outside the matrix (none exist today, but nothing stops one being
 * added) keeps its place relative to other unmatched categories — the DB query
 * already sorted those alphabetically — and sorts after every matched one.
 */
export function byCategoryOrder(a: { slug: string }, b: { slug: string }): number {
  const indexA = CATEGORY_ORDER.indexOf(a.slug);
  const indexB = CATEGORY_ORDER.indexOf(b.slug);
  if (indexA === -1 && indexB === -1) return 0;
  if (indexA === -1) return 1;
  if (indexB === -1) return -1;
  return indexA - indexB;
}
