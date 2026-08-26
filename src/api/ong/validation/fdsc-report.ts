import { z } from "zod";

export const createFdscReportSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Denumirea raportului este obligatorie")
    .max(200, "Denumirea raportului este prea lungă"),
  evaluation: z.string().trim().length(24, "Evaluarea selectată este invalidă"),
});
