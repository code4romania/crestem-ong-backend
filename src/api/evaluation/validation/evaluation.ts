import { z } from "zod";
import { DIMENSIONS } from "../../../constants/dimensions";

const dimensionKeys = DIMENSIONS.map((d) => d.key) as [string, ...string[]];

export const evaluationDimensionsSchema = z
  .array(
    z.object({
      dimensionKey: z.enum(dimensionKeys),
      submit: z.boolean().optional().default(false),
      comment: z.string().trim().optional().default(""),
      quiz: z.array(
        z.object({
          questionId: z.string().trim().min(1),
          answer: z.number().int(),
        }),
      ),
    }),
  )
  .max(DIMENSIONS.length)
  .superRefine((blocks, ctx) => {
    const seen = new Set<string>();
    for (const block of blocks) {
      if (seen.has(block.dimensionKey)) {
        ctx.addIssue({
          code: "custom",
          message: `Dimensiunea ${block.dimensionKey} apare de mai multe ori`,
        });
      }
      seen.add(block.dimensionKey);
      const dimension = DIMENSIONS.find((d) => d.key === block.dimensionKey);
      if (!dimension) {
        continue;
      }
      const expected = new Map(
        dimension.quiz.map((question) => [question.id, question]),
      );
      const answered = new Set<string>();
      for (const answer of block.quiz) {
        const question = expected.get(answer.questionId);
        if (!question) {
          ctx.addIssue({
            code: "custom",
            message: `Întrebarea ${answer.questionId} nu aparține dimensiunii ${block.dimensionKey}`,
          });
          continue;
        }
        if (answered.has(answer.questionId)) {
          ctx.addIssue({
            code: "custom",
            message: `Întrebarea ${answer.questionId} apare de mai multe ori`,
          });
          continue;
        }
        if (!question.options.some((option) => option.value === answer.answer)) {
          ctx.addIssue({
            code: "custom",
            message: `Răspunsul ${answer.answer} nu este valid pentru întrebarea ${answer.questionId}`,
          });
          continue;
        }
        answered.add(answer.questionId);
      }
      if (!block.submit) {
        continue;
      }
      const missing = dimension.quiz
        .map((question) => question.id)
        .filter((id) => !answered.has(id));
      if (missing.length) {
        ctx.addIssue({
          code: "custom",
          message: `Dimensiunea ${block.dimensionKey} nu are răspuns la: ${missing.join(", ")}`,
        });
      }
    }
  });
