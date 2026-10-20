/**
 * The filters of the FDSC organizations list, shared by the paginated list and
 * its export so the downloaded file holds exactly what the screen shows.
 */
export interface OngListParams {
  search?: string;
  /** A județ `documentId`. */
  judet?: string;
  /** A program `documentId`. */
  program?: string;
}

export const ongListFilters = ({
  search,
  judet,
  program,
}: OngListParams): Record<string, unknown> => {
  const filters: Record<string, unknown> = {};
  if (search) {
    filters.name = { $containsi: search };
  }
  if (judet) {
    filters.judet = { documentId: judet };
  }
  if (program) {
    filters.programs = { documentId: program };
  }
  return filters;
};
