import { computeProgress, type EvaluationStatus } from "./progress";
import { computeEvaluationScores } from "../../report/utils/scores";
import { isClosed } from "../../report/utils/lifecycle";
import { memberView, type MemberView } from "../../report/utils/members";

/**
 * What a row needs. `quiz` is a component nested inside the `dimensions`
 * component, and `dimensions: true` stops at the outer one — without the nested
 * populate the answers never arrive, every dimension reads as incomplete and
 * every score comes back null.
 */
export const ADMIN_EVALUATION_POPULATE = {
  dimensions: { populate: { quiz: true } },
  user: true,
  report: {
    populate: { ong: true, phases: { populate: { program: true } } },
  },
} as const;

/** The program-filter entry that selects the rounds outside every program. */
export const INDEPENDENT = "independent";

export interface ProgramRef {
  documentId: string;
  name: string;
}

export interface AdminEvaluationRow {
  documentId: string;
  ong: { documentId: string; name: string } | null;
  user: MemberView | null;
  /** Every program the evaluation's round belongs to, each listed once. */
  programs: ProgramRef[];
  /** A round attached to no program phase — the organization ran it on its own. */
  independent: boolean;
  status: EvaluationStatus;
  score: number | null;
  completedAt: string | null;
  report: { documentId: string; name: string } | null;
}

export interface AdminEvaluationFilters {
  today: string;
  status?: string;
  /**
   * The programs picked, possibly including `independent`. Narrowed here only
   * when that entry is among them — otherwise the database has done it.
   */
  programs?: string[];
}

/** Whether the picked programs include the entry no query can express. */
export const includesIndependent = (programs?: string[]): boolean =>
  (programs ?? []).includes(INDEPENDENT);

const matchesPrograms = (row: AdminEvaluationRow, programs: string[]): boolean =>
  (row.independent && programs.includes(INDEPENDENT)) ||
  row.programs.some((listed) => programs.includes(listed.documentId));

const programsOfReport = (report: any): ProgramRef[] => {
  const programs: ProgramRef[] = [];
  for (const phase of (report?.phases ?? []) as any[]) {
    const program = phase?.program;
    if (!program) continue;
    if (programs.some((listed) => listed.documentId === program.documentId)) {
      continue;
    }
    programs.push({ documentId: program.documentId, name: program.name });
  }
  return programs;
};

const toRow = (evaluation: any, today: string): AdminEvaluationRow => {
  const report = evaluation.report ?? null;
  const programs = programsOfReport(report);
  return {
    documentId: evaluation.documentId,
    ong: report?.ong
      ? { documentId: report.ong.documentId, name: report.ong.name }
      : null,
    user: evaluation.user ? memberView(evaluation.user) : null,
    programs,
    independent: programs.length === 0,
    status: computeProgress(evaluation.dimensions, isClosed(report, today))
      .status,
    score: computeEvaluationScores(evaluation).overall,
    completedAt: evaluation.completedAt ?? null,
    report: report
      ? { documentId: report.documentId, name: report.name }
      : null,
  };
};

/**
 * Status is derived from the answer blocks rather than stored, and being outside
 * every program is derived from the round's phases, so neither can be a database
 * filter. The rows are shaped first and narrowed here.
 */
export const buildAdminEvaluationRows = (
  evaluations: any[],
  { today, status, programs }: AdminEvaluationFilters,
): AdminEvaluationRow[] => {
  const byCreatedAt = new Map<string, string>();
  const rows = evaluations
    .map((evaluation) => {
      const row = toRow(evaluation, today);
      // The row's own creation, which is also what the database sorts on when it
      // paginates. It falls back to the round's, so a fixture or a record from
      // before the column was populated still orders by its round.
      byCreatedAt.set(
        row.documentId,
        evaluation.createdAt ?? evaluation.report?.createdAt ?? "",
      );
      return row;
    })
    .filter((row) =>
      // Only when the independent entry is among them: the database cannot select
      // a round without phases, so the whole program filter moves here.
      includesIndependent(programs) ? matchesPrograms(row, programs!) : true,
    )
    .filter((row) => (status ? row.status === status : true));

  return rows.sort((a, b) => {
    const rounds = (byCreatedAt.get(b.documentId) ?? "").localeCompare(
      byCreatedAt.get(a.documentId) ?? "",
    );
    if (rounds !== 0) return rounds;
    return (a.user?.nume ?? "").localeCompare(b.user?.nume ?? "", "ro");
  });
};

/**
 * The criteria the database answers on its own: the respondent's address, the
 * organizations picked and — unless the independent entry is among them — the
 * programs picked.
 */
export const adminEvaluationDbFilters = ({
  search,
  ongs,
  programs,
}: {
  search?: string;
  ongs?: string[];
  programs?: string[];
}): Record<string, unknown> => {
  const filters: Record<string, unknown> = {};
  const term = search?.trim();
  if (term) {
    filters.user = { email: { $containsi: term } };
  }
  const report: Record<string, unknown> = {};
  if (ongs?.length) {
    report.ong = { documentId: { $in: ongs } };
  }
  // No query selects a round without phases, so a filter carrying the
  // independent entry is applied by `buildAdminEvaluationRows` instead.
  if (programs?.length && !includesIndependent(programs)) {
    report.phases = { program: { documentId: { $in: programs } } };
  }
  if (Object.keys(report).length > 0) {
    filters.report = report;
  }
  return filters;
};

/**
 * Whether the request has to be paginated after the rows are built. Status and
 * the independent entry are derived per row, so a page of either can only be cut
 * once every matching evaluation is in hand; without them the database filters,
 * sorts and slices on its own.
 */
export const needsInMemoryPagination = ({
  status,
  programs,
}: {
  status?: string;
  ongs?: string[];
  programs?: string[];
}): boolean => Boolean(status) || includesIndependent(programs);

export interface Pagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export const paginate = <T>(
  rows: T[],
  page: number,
  pageSize: number,
): { data: T[]; pagination: Pagination } => ({
  data: rows.slice((page - 1) * pageSize, page * pageSize),
  pagination: {
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
    total: rows.length,
  },
});
