import { computeProgress } from "../../evaluation/utils/progress";
import {
  INDEPENDENT,
  includesIndependent,
  type ProgramRef,
} from "../../evaluation/utils/admin-list";
import { computeReportScores } from "./scores";
import { isClosed } from "./lifecycle";

/**
 * What a row needs. `quiz` sits in a component nested inside `dimensions`, and
 * the shorthand stops at the outer one — without it the answers never arrive and
 * every score comes back null.
 */
export const ADMIN_REPORT_POPULATE = {
  ong: true,
  phases: { populate: { program: true } },
  evaluations: { populate: { dimensions: { populate: { quiz: true } } } },
} as const;

/** A round is running until it is finished by hand or its phases have all ended. */
export type RoundStatus = "in_desfasurare" | "finalizata";

export interface AdminReportRow {
  documentId: string;
  name: string;
  ong: { documentId: string; name: string } | null;
  programs: ProgramRef[];
  /** A round attached to no program phase — the organization ran it on its own. */
  independent: boolean;
  roundStatus: RoundStatus;
  /** Responses that answered every dimension, against the respondents invited. */
  completedCount: number;
  invitedCount: number;
  score: number | null;
  finishedAt: string | null;
}

export interface AdminReportFilters {
  today: string;
  /**
   * One of the four per-response statuses. A round matches when at least one of
   * its responses is in it — the status of a respondent, not of the round.
   */
  status?: string;
  programs?: string[];
}

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

const toRow = (report: any, today: string): AdminReportRow => {
  const closed = isClosed(report, today);
  const evaluations = (report.evaluations ?? []) as any[];
  const programs = programsOfReport(report);
  return {
    documentId: report.documentId,
    name: report.name,
    ong: report.ong
      ? { documentId: report.ong.documentId, name: report.ong.name }
      : null,
    programs,
    independent: programs.length === 0,
    roundStatus: closed ? "finalizata" : "in_desfasurare",
    completedCount: evaluations.filter(
      (evaluation) => computeProgress(evaluation.dimensions, closed).complete,
    ).length,
    invitedCount: evaluations.length,
    score: computeReportScores(evaluations).overall,
    finishedAt: report.finishedAt ?? null,
  };
};

const hasResponseInStatus = (report: any, today: string, status: string) => {
  const closed = isClosed(report, today);
  return ((report.evaluations ?? []) as any[]).some(
    (evaluation) =>
      computeProgress(evaluation.dimensions, closed).status === status,
  );
};

const matchesPrograms = (row: AdminReportRow, programs: string[]) =>
  (row.independent && programs.includes(INDEPENDENT)) ||
  row.programs.some((listed) => programs.includes(listed.documentId));

/**
 * The rounds of every organization, newest first. Both derived filters are
 * applied here: the responses' statuses and, when the independent entry is
 * picked, program membership.
 */
export const buildAdminReportRows = (
  reports: any[],
  { today, status, programs }: AdminReportFilters,
): AdminReportRow[] => {
  const byCreatedAt = new Map<string, string>();
  return reports
    .filter((report) =>
      status ? hasResponseInStatus(report, today, status) : true,
    )
    .map((report) => {
      const row = toRow(report, today);
      byCreatedAt.set(row.documentId, report.createdAt ?? "");
      return row;
    })
    .filter((row) =>
      includesIndependent(programs) ? matchesPrograms(row, programs!) : true,
    )
    .sort((a, b) =>
      (byCreatedAt.get(b.documentId) ?? "").localeCompare(
        byCreatedAt.get(a.documentId) ?? "",
      ),
    );
};

/**
 * The criteria the database answers on its own. The search reaches an
 * organization through its administrators' addresses or its fiscal code — the
 * two identifiers this screen searches by.
 */
export const adminReportDbFilters = ({
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
    filters.$or = [
      {
        ong: {
          users: {
            email: { $containsi: term },
            role: { type: "ngo-admin" },
          },
        },
      },
      { ong: { cui: { $containsi: term } } },
    ];
  }
  if (ongs?.length) {
    filters.ong = { documentId: { $in: ongs } };
  }
  if (programs?.length && !includesIndependent(programs)) {
    filters.phases = { program: { documentId: { $in: programs } } };
  }
  return filters;
};

export const reportNeedsInMemoryPagination = ({
  status,
  programs,
}: {
  status?: string;
  ongs?: string[];
  programs?: string[];
}): boolean => Boolean(status) || includesIndependent(programs);
