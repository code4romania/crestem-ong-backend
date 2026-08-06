import { DIMENSIONS } from "../../../constants/dimensions";

const byKey = new Map(DIMENSIONS.map((dimension) => [dimension.key, dimension]));

export const decorateBlock = (block: any) => {
  const dimension = byKey.get(block.dimensionKey);
  const questions = new Map(
    (dimension?.quiz ?? []).map((question) => [question.id, question]),
  );
  return {
    dimensionKey: block.dimensionKey,
    name: dimension?.name ?? null,
    comment: block.comment,
    submitted: Boolean(block.submitted),
    quiz: (block.quiz ?? []).map((answer: any) => {
      const question = questions.get(answer.questionId);
      return {
        questionId: answer.questionId,
        question: question?.question ?? null,
        tag: question?.tag ?? null,
        answer: answer.answer,
        answerLabel:
          question?.options.find((option) => option.value === answer.answer)
            ?.label ?? null,
      };
    }),
  };
};
