import { allPhasesEnded } from "./association";

export interface ReportForLifecycle {
  phases?: unknown[] | null;
  evaluations?: { dimensions?: unknown[] | null }[] | null;
}

export const isProgramReport = (report: ReportForLifecycle) =>
  (report.phases ?? []).length > 0;

export const isClosed = (report: any, today: string) =>
  Boolean(report?.finished) || allPhasesEnded(report, today);

/**
 * Error `details` for a respondent saving into a round that has closed —
 * finished by hand or past its last phase. The frontend keys its "Evaluarea a
 * fost închisă" dialog on `code`, not on the message text.
 */
export const ROUND_CLOSED = { code: "ROUND_CLOSED" } as const;

/** Why the FDSC Admin cannot close this round now, or null when they can. */
export const adminCloseError = (report: any, today: string): string | null =>
  isClosed(report, today) ? "Evaluarea este deja închisă" : null;

/**
 * Why the FDSC Admin cannot reopen this round now, or null when they can. A
 * program round reopens only while one of its phases still runs; an
 * independent round has no phase and reopens at any time. Only one round per
 * organization may be under way.
 */
export const adminReopenError = (
  report: any,
  today: string,
  otherOpenReport: boolean,
): string | null => {
  if (allPhasesEnded(report, today)) {
    return "Faza de evaluare s-a încheiat; evaluarea nu mai poate fi redeschisă";
  }
  if (!report?.finished) {
    return "Evaluarea este deja în desfășurare";
  }
  if (otherOpenReport) {
    return "Organizația are deja o evaluare în desfășurare. Aceasta trebuie închisă înainte de a redeschide altă evaluare.";
  }
  return null;
};

export const hasResponses =(report: ReportForLifecycle) =>
  (report.evaluations ?? []).some(
    (evaluation) => (evaluation.dimensions ?? []).length > 0,
  );
