import { computeReportScores, round1 } from "../../report/utils/scores";
import { isClosed } from "../../report/utils/lifecycle";

export interface OngDashboardMentor {
  documentId: string;
  nume: string;
  mentorJobTitle: string | null;
  avatar: { documentId: string; name: string; url: string } | null;
  program: {
    documentId: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
}

export interface OngDashboard {
  memberCount: number;
  programCount: number;
  activeProgramCount: number;
  finishedReportCount: number;
  lastScore: number | null;
  averageScore: number | null;
  mentors: OngDashboardMentor[];
  recentPrograms: { documentId: string; name: string; programStatus: string }[];
}

export interface ScoredRound {
  overall: number | null;
  /** `finishedAt`, or `createdAt` for a round auto-closed without a timestamp. */
  at: string;
}

/**
 * "Scor ultima evaluare" and its "medie generală" caption.
 *
 * The headline is the newest round's own score even when that round has no
 * score yet, so the card never silently shows an older number. The average
 * ignores unscored rounds instead of treating them as zero.
 */
export function scoreSummary(rounds: ScoredRound[]): {
  lastScore: number | null;
  averageScore: number | null;
} {
  const byDate = [...rounds].sort((a, b) => `${b.at}`.localeCompare(`${a.at}`));
  const scored = rounds
    .map((round) => round.overall)
    .filter((overall): overall is number => overall !== null);

  return {
    lastScore: byDate.length > 0 ? byDate[0].overall : null,
    averageScore:
      scored.length > 0
        ? round1(scored.reduce((sum, value) => sum + value, 0) / scored.length)
        : null,
  };
}

/** `ngo-mentor.program` and `.ong` are list relations even though a row always
 * describes a single pair — normalize before reading the first entry. */
const firstOf = (value: any): any =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

/**
 * When a round closed, for ordering. A round closed by its phases running out
 * has no `finishedAt`, so fall back to its last phase end date — the same rule
 * `ong.overview` uses for `lastFinalizedDate` — and to `createdAt` beyond that.
 */
const closedAt = (report: any): string =>
  report.finishedAt ??
  ((report.phases ?? []) as any[])
    .map((phase) => phase.endDate)
    .filter(Boolean)
    .sort()
    .pop() ??
  report.createdAt ??
  "";

const RECENT_PROGRAM_LIMIT = 3;

export async function buildOngDashboard(
  strapi: any,
  ongDocumentId: string,
  today: string,
): Promise<OngDashboard> {
  const [memberCount, programs, reports, ngoMentors] = await Promise.all([
    strapi.documents("plugin::users-permissions.user").count({
      filters: {
        ong: { documentId: ongDocumentId },
        role: { type: "ngo-member" },
      },
    }),
    strapi.documents("api::program.program").findMany({
      filters: { ongs: { documentId: ongDocumentId } },
      populate: { mentors: true },
    }),
    // Every round, closed or not: a round attached to program phases closes
    // when its last phase ends and keeps `finished: false`, so the filtering
    // has to happen through `isClosed` rather than in the query.
    strapi.documents("api::report.report").findMany({
      filters: { ong: { documentId: ongDocumentId } },
      populate: {
        evaluations: { populate: { dimensions: { populate: { quiz: true } } } },
        phases: true,
      },
    }),
    strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
      filters: { ong: { documentId: ongDocumentId } },
      populate: { mentors: { populate: { avatar: true } }, program: true },
    }),
  ]);

  const programList = (programs ?? []) as any[];
  const byStartDateDesc = [...programList].sort((a, b) =>
    `${b.startDate}`.localeCompare(`${a.startDate}`),
  );
  const programById = new Map(
    programList.map((program) => [program.documentId, program]),
  );

  const closedReports = ((reports ?? []) as any[]).filter((report) =>
    isClosed(report, today),
  );
  const { lastScore, averageScore } = scoreSummary(
    closedReports.map((report) => ({
      overall: computeReportScores(report.evaluations ?? []).overall,
      at: closedAt(report),
    })),
  );

  // One row per (mentor, program) pair, mirroring the mockup's table where the
  // PERIOADĂ column is the program's own date range. A mentor dropped from the
  // program itself stays on the `ngo-mentor` row, so intersect with the
  // program's mentor list — the rule `ngoMentorsFor` already applies.
  const mentors: OngDashboardMentor[] = [];
  for (const row of (ngoMentors ?? []) as any[]) {
    const program = programById.get(firstOf(row.program)?.documentId);
    if (!program) {
      continue;
    }
    const programMentorIds = new Set(
      ((program.mentors ?? []) as any[]).map((mentor) => mentor.documentId),
    );
    for (const mentor of (row.mentors ?? []) as any[]) {
      if (!programMentorIds.has(mentor.documentId)) {
        continue;
      }
      mentors.push({
        documentId: mentor.documentId,
        nume: mentor.nume,
        mentorJobTitle: mentor.mentorJobTitle ?? null,
        avatar: mentor.avatar
          ? {
              documentId: mentor.avatar.documentId,
              name: mentor.avatar.name,
              url: mentor.avatar.url,
            }
          : null,
        program: {
          documentId: program.documentId,
          name: program.name,
          startDate: program.startDate,
          endDate: program.endDate,
        },
      });
    }
  }

  return {
    memberCount,
    programCount: programList.length,
    activeProgramCount: programList.filter(
      (program) => program.programStatus === "Active",
    ).length,
    finishedReportCount: closedReports.length,
    lastScore,
    averageScore,
    mentors,
    recentPrograms: byStartDateDesc
      .slice(0, RECENT_PROGRAM_LIMIT)
      .map((program) => ({
        documentId: program.documentId,
        name: program.name,
        programStatus: program.programStatus,
      })),
  };
}
