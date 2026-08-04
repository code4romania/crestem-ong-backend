import { z } from "zod";

export const updateReportSchema = z.object({
  finished: z.boolean(),
});
