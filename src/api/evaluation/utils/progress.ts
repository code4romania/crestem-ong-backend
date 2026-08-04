import { DIMENSIONS } from "../../../constants/dimensions";

export interface EvaluationProgress {
  completedDimensions: string[];
  nextDimension: string | null;
  complete: boolean;
}

export const computeProgress = (
  blocks: { dimensionKey?: string | null }[] | null | undefined,
): EvaluationProgress => {
  const savedKeys = new Set((blocks ?? []).map((block) => block.dimensionKey));
  const completedDimensions = DIMENSIONS.filter((dimension) =>
    savedKeys.has(dimension.key),
  ).map((dimension) => dimension.key);
  const nextDimension =
    DIMENSIONS.find((dimension) => !savedKeys.has(dimension.key))?.key ?? null;
  return {
    completedDimensions,
    nextDimension,
    complete: nextDimension === null,
  };
};
