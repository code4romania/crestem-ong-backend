import { z } from "zod";

export const startEvaluationSchema = z.object({
  program: z.string().min(1).optional(),
  members: z
    .array(z.string().min(1))
    .min(1, "Selectează cel puțin un membru"),
});
