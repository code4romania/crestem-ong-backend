/**
 * Which organizations and programs the "Evaluări" filters are allowed to offer.
 * Listing every organization and every program would offer choices that match
 * nothing: the dropdowns exist to narrow rows, so they carry only the values a
 * row can actually have.
 *
 * The two tabs count different things — one lists responses, the other lists
 * rounds — so a round nobody was invited to belongs to the rounds tab's options
 * and not to the responses tab's.
 */
export type OptionScopeKind = "evaluations" | "reports";

export interface OptionScope {
  ongs: Set<string>;
  programs: Set<string>;
  /** Whether any round in scope sits outside every program. */
  hasIndependent: boolean;
}

export const optionScope = (
  reports: any[],
  kind: OptionScopeKind,
  /** The rounds that have at least one response, for the responses tab. */
  answeredReports: Set<string> = new Set(),
): OptionScope => {
  const inScope =
    kind === "reports"
      ? reports
      : reports.filter((report) => answeredReports.has(report.documentId));

  const ongs = new Set<string>();
  const programs = new Set<string>();
  let hasIndependent = false;

  for (const report of inScope) {
    if (report.ong?.documentId) {
      ongs.add(report.ong.documentId);
    }
    const phases = (report.phases ?? []) as any[];
    const reportPrograms = phases
      .map((phase) => phase?.program?.documentId)
      .filter(Boolean) as string[];
    if (reportPrograms.length === 0) {
      hasIndependent = true;
    }
    for (const program of reportPrograms) {
      programs.add(program);
    }
  }

  return { ongs, programs, hasIndependent };
};

/**
 * What the scope query reads. No `evaluations`: populating them pulled every
 * response of every round only to ask whether there was one, which is the whole
 * cost of this endpoint. The flat query behind `answeredReports` answers that
 * with one small row per response instead.
 */
export const OPTION_SCOPE_POPULATE = {
  ong: true,
  phases: { populate: { program: true } },
} as const;

/** The rounds that received a response, read one flat row per response. */
export const ANSWERED_REPORTS_POPULATE = { report: true } as const;
