import type { Dimension } from "../../../constants/dimensions";
import { DIMENSIONS } from "../../../constants/dimensions";

export interface EvaluationForScoring {
  dimensions?:
    | {
        dimensionKey?: string | null;
        submitted?: boolean | null;
        quiz?: { questionId?: string | null; answer?: number | null }[] | null;
      }[]
    | null;
}

type ScoringBlock = EvaluationForScoring["dimensions"][number];

export interface ReportScores {
  dimensions: Record<string, number | null>;
  overall: number | null;
}

/** One decimal, the precision every score in the app is reported at. */
export const round1 = (value: number) => Math.round(value * 10) / 10;

const answeredIds = (block: ScoringBlock) =>
  new Set((block?.quiz ?? []).map((question) => question.questionId));

const isDimensionComplete = (dimension: Dimension, block?: ScoringBlock) => {
  if (!block?.submitted) {
    return false;
  }
  const answered = answeredIds(block);
  return dimension.quiz.every((question) => answered.has(question.id));
};

const dimensionPercentage = (dimension: Dimension, block: ScoringBlock) => {
  const total = dimension.quiz.reduce((sum, question) => {
    const answer = (block.quiz ?? []).find(
      (item) => item.questionId === question.id,
    );
    return sum + (answer?.answer ?? 0);
  }, 0);
  const min = dimension.quiz.reduce(
    (sum, question) =>
      sum + Math.min(...question.options.map((option) => option.value)),
    0,
  );
  const max = dimension.quiz.reduce(
    (sum, question) =>
      sum + Math.max(...question.options.map((option) => option.value)),
    0,
  );
  return max === min ? 0 : ((total - min) / (max - min)) * 100;
};

const isComplete = (evaluation: EvaluationForScoring) => {
  const blocks = evaluation.dimensions ?? [];
  return DIMENSIONS.every((dimension) =>
    isDimensionComplete(
      dimension,
      blocks.find((b) => b.dimensionKey === dimension.key),
    ),
  );
};

export const isEvaluationComplete = isComplete;

/**
 * Per-respondent scores. Unlike the report-level average this scores every
 * submitted dimension on its own, so a member sees partial results while the
 * remaining dimensions are still open. `overall` stays null until all of them
 * are submitted.
 */
export const computeEvaluationScores = (
  evaluation: EvaluationForScoring,
): ReportScores => {
  const blocks = evaluation.dimensions ?? [];
  const dimensions: Record<string, number | null> = {};
  for (const dimension of DIMENSIONS) {
    const block = blocks.find((b) => b.dimensionKey === dimension.key);
    dimensions[dimension.key] = isDimensionComplete(dimension, block)
      ? round1(dimensionPercentage(dimension, block))
      : null;
  }
  const values = Object.values(dimensions);
  const overall = values.some((value) => value === null)
    ? null
    : round1(
        (values as number[]).reduce((sum, value) => sum + value, 0) /
          values.length,
      );
  return { dimensions, overall };
};

export const computeReportScores = (
  evaluations: EvaluationForScoring[],
): ReportScores => {
  const complete = evaluations.filter(isComplete);
  const dimensions: Record<string, number | null> = {};
  for (const dimension of DIMENSIONS) {
    if (complete.length === 0) {
      dimensions[dimension.key] = null;
      continue;
    }
    const percentages = complete.map((evaluation) =>
      dimensionPercentage(
        dimension,
        evaluation.dimensions.find((b) => b.dimensionKey === dimension.key),
      ),
    );
    dimensions[dimension.key] = round1(
      percentages.reduce((sum, p) => sum + p, 0) / percentages.length,
    );
  }
  const values = Object.values(dimensions);
  const overall = values.some((v) => v === null)
    ? null
    : round1(
        (values as number[]).reduce((sum, v) => sum + v, 0) / values.length,
      );
  return { dimensions, overall };
};
