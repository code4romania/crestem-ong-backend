import { computeProgress } from "../../evaluation/utils/progress";
import { computeReportScores } from "./scores";
import { isClosed } from "./lifecycle";

/** The summary shape both `/reports/current` and the member overview return. */
export const reportView = (report: any, today: string) => {
  const evaluations = (report.evaluations ?? []) as any[];
  const closed = isClosed(report, today);
  return {
    documentId: report.documentId,
    name: report.name,
    finished: closed,
    invitedCount: evaluations.length,
    completedCount: evaluations.filter(
      (evaluation) => computeProgress(evaluation.dimensions, closed).complete,
    ).length,
    score: computeReportScores(evaluations).overall,
  };
};

/**
 * Every program an organization takes part in, each with its phases in date
 * order and the report attached to each phase.
 *
 * Shared by the ngo-admin `/reports/current` and the ngo-member
 * `/me/ongs/:ongDocumentId/rounds`: both dashboards derive the same Overview
 * counters from it, so the two roles cannot drift apart on what "the current
 * program" or "the current evaluation" means.
 */
export async function buildProgramRounds(
  strapi: any,
  ongDocumentId: string,
  today: string,
) {
  const programs = await strapi.documents("api::program.program").findMany({
    filters: { ongs: { documentId: ongDocumentId } },
    sort: { startDate: "desc" },
    populate: { phases: true, ongs: true },
  });
  const programRounds: any[] = [];
  for (const program of programs as any[]) {
    const reports = await strapi.documents("api::report.report").findMany({
      filters: {
        ong: { documentId: ongDocumentId },
        phases: { program: { documentId: program.documentId } },
      },
      populate: {
        evaluations: { populate: { dimensions: { populate: { quiz: true } } } },
        phases: true,
      },
    });
    const phases = [...((program.phases ?? []) as any[])].sort((a, b) =>
      `${a.startDate}`.localeCompare(`${b.startDate}`),
    );
    const reportByPhase = new Map<string, any>();
    for (const report of reports as any[]) {
      for (const phase of (report.phases ?? []) as any[]) {
        reportByPhase.set(phase.documentId, report);
      }
    }
    programRounds.push({
      program: {
        documentId: program.documentId,
        name: program.name,
        startDate: program.startDate,
        endDate: program.endDate,
        programStatus: program.programStatus,
        ongsCount: ((program.ongs ?? []) as any[]).length,
      },
      phases: phases.map((phase) => ({
        documentId: phase.documentId,
        title: phase.title,
        startDate: phase.startDate,
        endDate: phase.endDate,
        hasEvaluation: phase.hasEvaluation,
        active: `${phase.startDate}` <= today && `${phase.endDate}` >= today,
        report: reportByPhase.has(phase.documentId)
          ? reportView(reportByPhase.get(phase.documentId), today)
          : null,
      })),
    });
  }
  return programRounds;
}
