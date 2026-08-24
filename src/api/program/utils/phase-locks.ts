import { toDateString } from "../../../utils/date";
import { computeProgramStatus } from "./status";

export type PhaseBucket = "finished" | "current" | "future";

export interface StoredPhase {
  documentId: string;
  title: string;
  startDate: unknown;
  endDate: unknown;
  hasEvaluation: boolean;
}

export interface SubmittedPhase {
  documentId?: string;
  title: string;
  startDate: string;
  endDate: string;
  hasEvaluation: boolean;
}

export const phaseBucket = (
  phase: { startDate: unknown; endDate: unknown },
  today: string,
): PhaseBucket => {
  if (toDateString(phase.endDate) < today) {
    return "finished";
  }
  if (toDateString(phase.startDate) > today) {
    return "future";
  }
  return "current";
};

export const programDatesLockError = (
  stored: { startDate?: unknown; endDate?: unknown },
  submitted: { startDate?: string; endDate?: string },
  today: string,
): string | null => {
  if (
    submitted.startDate !== undefined &&
    submitted.startDate !== toDateString(stored.startDate)
  ) {
    return "Data de început nu mai poate fi modificată după startul programului";
  }
  if (submitted.endDate !== undefined && submitted.endDate < today) {
    return "Data de sfârșit a programului nu poate fi în trecut";
  }
  return null;
};

export const phaseLockError = (
  storedPhases: StoredPhase[],
  submittedPhases: SubmittedPhase[],
  today: string,
): string | null => {
  const submittedById = new Map(
    submittedPhases
      .filter((phase) => phase.documentId)
      .map((phase) => [phase.documentId, phase]),
  );

  for (const stored of storedPhases) {
    const bucket = phaseBucket(stored, today);
    if (bucket === "future" || submittedById.has(stored.documentId)) {
      continue;
    }
    return bucket === "finished"
      ? `Faza ${stored.title} este încheiată și nu poate fi ștearsă`
      : `Faza ${stored.title} este în desfășurare și nu poate fi ștearsă`;
  }

  for (const submitted of submittedPhases) {
    if (!submitted.documentId) {
      if (submitted.startDate <= today) {
        return `Faza ${submitted.title} trebuie să înceapă după ziua curentă`;
      }
      continue;
    }
    const stored = storedPhases.find(
      (phase) => phase.documentId === submitted.documentId,
    );
    if (!stored) {
      continue;
    }
    const bucket = phaseBucket(stored, today);
    if (bucket === "future") {
      continue;
    }
    const sameHead =
      submitted.title === stored.title &&
      submitted.startDate === toDateString(stored.startDate) &&
      submitted.hasEvaluation === stored.hasEvaluation;
    if (bucket === "finished") {
      if (!sameHead || submitted.endDate !== toDateString(stored.endDate)) {
        return `Faza ${stored.title} este încheiată și nu mai poate fi modificată`;
      }
      continue;
    }
    if (!sameHead) {
      return `Faza ${stored.title} este în desfășurare; doar data de sfârșit poate fi modificată`;
    }
    if (submitted.endDate < today) {
      return `Data de sfârșit a fazei ${stored.title} nu poate fi în trecut`;
    }
  }

  return null;
};

/**
 * A finished program is read-only: no edits, no deletion, no assignment
 * changes. The status is recomputed from the dates rather than read from the
 * stored `programStatus` column, which only refreshes when the dates change.
 */
export const programFinishedError = (
  program: { startDate?: unknown; endDate?: unknown },
  today: string,
): string | null =>
  computeProgramStatus(
    toDateString(program.startDate),
    toDateString(program.endDate),
    today,
  ) === "Finished"
    ? "Programul este finalizat și nu mai poate fi modificat"
    : null;
