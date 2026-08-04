import { z } from "zod";

export const assignMentorsSchema = z.object({
  program: z
    .string({ message: "Programul este obligatoriu" })
    .min(1, "Programul este obligatoriu"),
  mentors: z
    .array(z.string({ message: "Mentor invalid" }).min(1, "Mentor invalid"), {
      message: "Lista de mentori este invalidă",
    })
    .min(1, "Selectează cel puțin un mentor"),
});
