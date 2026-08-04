import { z } from "zod";
import { DIMENSIONS } from "../../../constants/dimensions";

const dimensionKeys = DIMENSIONS.map((d) => d.key) as [string, ...string[]];

export const evaluationDimensionsSchema = z
  .array(
    z.object({
      dimensionKey: z.enum(dimensionKeys),
      quiz: z.array(
        z.object({
          answer: z.number().int().min(1).max(5),
        }),
      ),
      comment: z.string().trim().min(1, "Comentariul este obligatoriu"),
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
      if (dimension && block.quiz.length !== dimension.quiz.length) {
        ctx.addIssue({
          code: "custom",
          message: `Dimensiunea ${block.dimensionKey} trebuie să aibă ${dimension.quiz.length} răspunsuri`,
        });
      }
    }
  });
