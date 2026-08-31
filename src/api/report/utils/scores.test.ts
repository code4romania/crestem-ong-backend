import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../../constants/dimensions";
import {
  computeEvaluationScores,
  computeReportScores,
  type EvaluationForScoring,
} from "./scores";

const optionValues = (dimensionKey: string, questionId: string) => {
  const question = DIMENSIONS.find((d) => d.key === dimensionKey)!.quiz.find(
    (q) => q.id === questionId,
  )!;
  return question.options.map((option) => option.value);
};

/** Every dimension submitted, every question answered with `answer`. */
const fullEvaluation = (
  answer: number,
  overrides: Record<string, number> = {},
): EvaluationForScoring => ({
  dimensions: DIMENSIONS.map((dimension) => ({
    dimensionKey: dimension.key,
    submitted: true,
    quiz: dimension.quiz.map((question) => ({
      questionId: question.id,
      answer: overrides[question.id] ?? answer,
    })),
  })),
});

/** Complete except for one dropped answer, so the scoring filter excludes it. */
const partialEvaluation = (
  answer: number,
  overrides: Record<string, number> = {},
): EvaluationForScoring => {
  const evaluation = fullEvaluation(answer, overrides);
  evaluation.dimensions[1].quiz = evaluation.dimensions[1].quiz.slice(1);
  return evaluation;
};

describe("computeReportScores question scores", () => {
  it("averages a question over the complete evaluations only", () => {
    const values = optionValues("guvernanta", "guvernanta_q1");
    const max = Math.max(...values);
    const min = Math.min(...values);

    const scores = computeReportScores([
      fullEvaluation(3, { guvernanta_q1: max }),
      // Ignored: this respondent never finished, so their 1 must not drag the
      // question average down.
      partialEvaluation(3, { guvernanta_q1: min }),
    ]);

    expect(scores.questions.guvernanta_q1).toBe(100);
  });

  it("scores the lowest option at 0 and the highest at 100", () => {
    const values = optionValues("guvernanta", "guvernanta_q1");

    expect(
      computeReportScores([fullEvaluation(Math.min(...values))]).questions
        .guvernanta_q1,
    ).toBe(0);
    expect(
      computeReportScores([fullEvaluation(Math.max(...values))]).questions
        .guvernanta_q1,
    ).toBe(100);
  });

  it("returns null for every question when no evaluation is complete", () => {
    const scores = computeReportScores([partialEvaluation(4)]);

    expect(scores.questions.guvernanta_q1).toBeNull();
    expect(Object.values(scores.questions).every((v) => v === null)).toBe(true);
  });

  it("covers every question of every dimension", () => {
    const scores = computeReportScores([fullEvaluation(3)]);
    const allIds = DIMENSIONS.flatMap((d) => d.quiz.map((q) => q.id));

    expect(Object.keys(scores.questions).sort()).toEqual(allIds.sort());
  });
});

describe("computeEvaluationScores question scores", () => {
  it("scores the questions of a submitted dimension", () => {
    const values = optionValues("guvernanta", "guvernanta_q1");

    const scores = computeEvaluationScores(
      fullEvaluation(Math.max(...values)),
    );

    expect(scores.questions.guvernanta_q1).toBe(100);
  });

  it("leaves the questions of an unfinished dimension null", () => {
    const evaluation = partialEvaluation(5);
    const droppedKey = DIMENSIONS[1].key;
    const droppedId = DIMENSIONS[1].quiz[0].id;
    const keptId = DIMENSIONS[1].quiz[1].id;

    const scores = computeEvaluationScores(evaluation);

    expect(scores.dimensions[droppedKey]).toBeNull();
    expect(scores.questions[droppedId]).toBeNull();
    expect(scores.questions[keptId]).toBeNull();
  });
});
