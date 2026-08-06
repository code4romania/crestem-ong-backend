import { DIMENSIONS } from "../../../constants/dimensions";

export type EvaluationStatus =
  | "neinceput"
  | "in_lucru"
  | "completat"
  | "nefinalizat";

export interface EvaluationProgress {
  completedDimensions: string[];
  draftDimensions: string[];
  nextDimension: string | null;
  complete: boolean;
  status: EvaluationStatus;
}

export const computeProgress = (
  blocks:
    | { dimensionKey?: string | null; submitted?: boolean | null }[]
    | null
    | undefined,
  closed: boolean = false,
): EvaluationProgress => {
  const submittedKeys = new Set(
    (blocks ?? [])
      .filter((block) => block.submitted)
      .map((block) => block.dimensionKey),
  );
  const draftKeys = new Set(
    (blocks ?? [])
      .filter((block) => !block.submitted)
      .map((block) => block.dimensionKey),
  );
  const completedDimensions = DIMENSIONS.filter((dimension) =>
    submittedKeys.has(dimension.key),
  ).map((dimension) => dimension.key);
  const draftDimensions = DIMENSIONS.filter((dimension) =>
    draftKeys.has(dimension.key),
  ).map((dimension) => dimension.key);
  const nextDimension =
    DIMENSIONS.find((dimension) => !submittedKeys.has(dimension.key))?.key ??
    null;
  const complete = nextDimension === null;
  const started = completedDimensions.length > 0 || draftDimensions.length > 0;
  const status: EvaluationStatus = complete
    ? "completat"
    : !started
      ? "neinceput"
      : closed
        ? "nefinalizat"
        : "in_lucru";
  return {
    completedDimensions,
    draftDimensions,
    nextDimension,
    complete,
    status,
  };
};
