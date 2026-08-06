import { allPhasesEnded } from "./association";

export interface ReportForLifecycle {
  phases?: unknown[] | null;
  evaluations?: { dimensions?: unknown[] | null }[] | null;
}

export const isProgramReport = (report: ReportForLifecycle) =>
  (report.phases ?? []).length > 0;

export const isClosed = (report: any, today: string) =>
  Boolean(report?.finished) || allPhasesEnded(report, today);

export const hasResponses = (report: ReportForLifecycle) =>
  (report.evaluations ?? []).some(
    (evaluation) => (evaluation.dimensions ?? []).length > 0,
  );
