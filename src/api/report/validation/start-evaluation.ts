import { z } from "zod";

export const startEvaluationSchema = z.object({
  program: z.string().min(1).optional(),
  // May be empty: the admin starting the round is always added as a
  // respondent by the controller, so they can fill it in alone.
  members: z.array(z.string().min(1)),
});
