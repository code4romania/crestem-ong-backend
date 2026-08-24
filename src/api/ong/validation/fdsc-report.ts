import { z } from "zod";

export const createFdscReportSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Denumirea raportului este obligatorie")
    .max(200, "Denumirea raportului este prea lungă"),
  program: z.string().trim().length(24, "Programul selectat este invalid"),
});
