import { DIMENSIONS } from "../../../constants/dimensions";

export interface EvaluationForScoring {
  dimensions?:
    | {
        dimensionKey?: string | null;
        quiz?: { answer?: number | null }[] | null;
      }[]
    | null;
}

export interface ReportScores {
  dimensions: Record<string, number | null>;
  overall: number | null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

const isComplete = (evaluation: EvaluationForScoring) => {
  const blocks = evaluation.dimensions ?? [];
  return DIMENSIONS.every((dimension) => {
    const block = blocks.find((b) => b.dimensionKey === dimension.key);
    return (block?.quiz?.length ?? 0) === dimension.quiz.length;
  });
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
    const percentages = complete.map((evaluation) => {
      const block = evaluation.dimensions.find(
        (b) => b.dimensionKey === dimension.key,
      );
      const total = block.quiz.reduce((sum, q) => sum + (q.answer ?? 0), 0);
      return (
        ((total - dimension.quiz.length) / (dimension.quiz.length * 4)) * 100
      );
    });
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
