/**
 * The slice of a Document Service query that limits it to one page.
 *
 * Always spread this rather than passing `pagination: { page, pageSize }`: the
 * Document Service accepts that REST-shaped key at the root and then strips it
 * before the query builder ever sees it (see `@strapi/core`
 * `services/document-service/params.js` — only `filters`, `sort`, `fields`,
 * `populate`, `status`, `locale`, `page`, `pageSize`, `start`, `limit` get
 * through). A query written that way silently returns every row while its
 * `meta.pagination` claims a page of twenty.
 */
export function pageSlice(
  page: number,
  pageSize: number,
): { limit: number; start: number } {
  const safePage = page > 1 ? page : 1;
  return { limit: pageSize, start: (safePage - 1) * pageSize };
}
