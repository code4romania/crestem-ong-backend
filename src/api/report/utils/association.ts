import { toDateString, todayInBucharest } from "../../../utils/date";

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

export const resolvePickPhase = (
  program: any,
  phaseDocumentId: string | undefined,
  today: string,
  ongName: string,
): { phase: any } | { error: string } => {
  if (!phaseDocumentId) {
    const phase = targetEntryPhase(program, today);
    return phase
      ? { phase }
      : { error: "Programul nu are o fază care să accepte evaluare" };
  }
  const phase = ((program.phases ?? []) as any[]).find(
    (candidate) => candidate.documentId === phaseDocumentId,
  );
  if (!phase) {
    return {
      error: `Faza selectată nu aparține acestui program pentru organizația ${ongName}`,
    };
  }
  if (!phase.hasEvaluation) {
    return {
      error: `Faza ${phase.title} nu necesită evaluare pentru organizația ${ongName}`,
    };
  }
  return { phase };
};

export const phaseEndedForUnfinishedReport = (
  phase: any,
  report: any,
  today: string,
): boolean => toDateString(phase.endDate) < today && !report.finished;

export const phaseEvaluationsView = (
  program: any,
  ongDocumentId: string,
  reportsInProgramList: any[],
) =>
  evaluationPhases(program).map((phase) => {
    const report = reportsInProgramList.find(
      (candidate) =>
        candidate.ong?.documentId === ongDocumentId &&
        phasesOfProgram(candidate, program.documentId).includes(
          phase.documentId,
        ),
    );
    return {
      phaseDocumentId: phase.documentId,
      phaseTitle: phase.title,
      report: report
        ? { documentId: report.documentId, name: report.name }
        : null,
    };
  });

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

export const allPhasesEnded = (report: any, today: string) => {
  const phases = (report?.phases ?? []) as any[];
  return (
    phases.length > 0 &&
    phases.every((phase) => toDateString(phase.endDate) < today)
  );
};

export const findOpenReport = async (strapi: any, ongDocumentId: string) => {
  const open = await strapi.documents("api::report.report").findMany({
    filters: { ong: { documentId: ongDocumentId }, finished: false },
    populate: { phases: true },
  });
  const today = todayInBucharest();
  return (
    open.find((report: any) => !allPhasesEnded(report, today)) ?? null
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

export const reportsInProgram = async (
  strapi: any,
  programDocumentId: string,
) => {
  const reports = await strapi.documents("api::report.report").findMany({
    filters: { phases: { program: { documentId: programDocumentId } } },
    populate: {
      ong: true,
      originPhase: { populate: { program: true } },
      phases: { populate: { program: true } },
    },
  });
  return reports as any[];
};

export const phasesOfProgram = (report: any, programDocumentId: string) =>
  ((report.phases ?? []) as any[])
    .filter((phase) => phase.program?.documentId === programDocumentId)
    .map((phase) => phase.documentId);

export const phaseOfSameProgram = (report: any, programDocumentId: string) =>
  ((report.phases ?? []) as any[]).find(
    (phase) => phase.program?.documentId === programDocumentId,
  ) ?? null;
