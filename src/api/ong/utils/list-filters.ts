import { bucharestDayStart, nextDay } from "../../../utils/date";

/** The `program` value that asks for the organizations in no program at all. */
export const NO_PROGRAM = "none";

/**
 * The filters of the FDSC organizations list, shared by the paginated list and
 * its export so the downloaded file holds exactly what the screen shows.
 */
export interface OngListParams {
  search?: string;
  /** A județ `documentId`. */
  judet?: string;
  /** A program `documentId`, or `NO_PROGRAM`. */
  program?: string;
  /** First Bucharest day of sign-up, `YYYY-MM-DD`, inclusive. */
  inscrisDe?: string;
  /** Last Bucharest day of sign-up, `YYYY-MM-DD`, inclusive. */
  inscrisPana?: string;
}

export const ongListFilters = ({
  search,
  judet,
  program,
  inscrisDe,
  inscrisPana,
}: OngListParams): Record<string, unknown> => {
  const filters: Record<string, unknown> = {};
  if (search) {
    filters.name = { $containsi: search };
  }
  if (judet) {
    filters.judet = { documentId: judet };
  }
  if (program === NO_PROGRAM) {
    filters.programs = { id: { $null: true } };
  } else if (program) {
    filters.programs = { documentId: program };
  }
  // `createdAt` is an instant; the days are Bucharest days, so the range runs
  // from the start of the first one to the start of the day after the last.
  const createdAt: Record<string, string> = {};
  if (inscrisDe) {
    createdAt.$gte = bucharestDayStart(inscrisDe);
  }
  if (inscrisPana) {
    createdAt.$lt = bucharestDayStart(nextDay(inscrisPana));
  }
  if (Object.keys(createdAt).length > 0) {
    filters.createdAt = createdAt;
  }
  return filters;
};
