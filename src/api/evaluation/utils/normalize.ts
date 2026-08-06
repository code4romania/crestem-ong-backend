import { DIMENSIONS } from "../../../constants/dimensions";

export interface AnswerBlock {
  dimensionKey: string;
  comment: string;
  submitted: boolean;
  quiz: { questionId: string; answer: number }[];
}

export const normalizeBlocks = (blocks: AnswerBlock[]): AnswerBlock[] =>
  DIMENSIONS.flatMap((dimension) => {
    const block = blocks.find((b) => b.dimensionKey === dimension.key);
    if (!block) {
      return [];
    }
    return [
      {
        dimensionKey: block.dimensionKey,
        comment: block.comment,
        submitted: block.submitted,
        quiz: dimension.quiz.flatMap((question) => {
          const answer = block.quiz.find(
            (item) => item.questionId === question.id,
          );
          return answer
            ? [{ questionId: question.id, answer: answer.answer }]
            : [];
        }),
      },
    ];
  });
