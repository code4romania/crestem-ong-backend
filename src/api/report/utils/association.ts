import { toDateString } from "../../../utils/date";

export const evaluationPhases = (program: any) =>
  [...((program.phases ?? []) as any[])]
    .filter((phase) => phase.hasEvaluation)
    .sort((a, b) =>
      toDateString(a.startDate).localeCompare(toDateString(b.startDate)),
    );

export const activePhase = (program: any, today: string) =>
  evaluationPhases(program).find(
    (phase) =>
      toDateString(phase.startDate) <= today &&
      toDateString(phase.endDate) >= today,
  ) ?? null;

export const targetEntryPhase = (program: any, today: string) => {
  const running = activePhase(program, today);
  if (running) {
    return running;
  }
  const phases = evaluationPhases(program);
  if (toDateString(program.startDate) > today) {
    return phases[0] ?? null;
  }
  return phases.find((phase) => toDateString(phase.startDate) > today) ?? null;
};

export const findActivePhaseForOng = async (
  strapi: any,
  ongDocumentId: string,
  today: string,
) => {
  const programs = await strapi.documents("api::program.program").findMany({
    filters: {
      ongs: { documentId: ongDocumentId },
      startDate: { $lte: today },
      endDate: { $gte: today },
    },
    populate: { phases: true },
  });
  for (const program of programs) {
    const phase = activePhase(program, today);
    if (phase) {
      return { program, phase };
    }
  }
  return null;
};

export const findOpenReport = async (
  strapi: any,
  ongDocumentId: string,
  excludePhaseDocumentId?: string,
) => {
  const open = await strapi.documents("api::report.report").findMany({
    filters: { ong: { documentId: ongDocumentId }, finished: false },
    populate: { phases: true },
  });
  return (
    open.find(
      (report: any) =>
        !excludePhaseDocumentId ||
        !((report.phases ?? []) as any[]).some(
          (phase) => phase.documentId === excludePhaseDocumentId,
        ),
    ) ?? null
  );
};

export const findPhaseReport = async (
  strapi: any,
  phaseDocumentId: string,
  ongDocumentId: string,
) => {
  const reports = await strapi.documents("api::report.report").findMany({
    filters: {
      ong: { documentId: ongDocumentId },
      phases: { documentId: phaseDocumentId },
    },
    limit: 1,
  });
  return reports[0] ?? null;
};

export const ongsWithReportsInProgram = async (
  strapi: any,
  programDocumentId: string,
) => {
  const reports = await strapi.documents("api::report.report").findMany({
    filters: { phases: { program: { documentId: programDocumentId } } },
    populate: { ong: true },
  });
  return new Set(
    (reports as any[])
      .map((report) => report.ong?.documentId)
      .filter(Boolean) as string[],
  );
};

export const phaseOfSameProgram = (report: any, programDocumentId: string) =>
  ((report.phases ?? []) as any[]).find(
    (phase) => phase.program?.documentId === programDocumentId,
  ) ?? null;
