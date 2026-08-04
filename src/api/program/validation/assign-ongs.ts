import { z } from "zod";

export const assignOngsSchema = z.object({
  program: z
    .string({ message: "Programul este obligatoriu" })
    .min(1, "Programul este obligatoriu"),
  ongs: z
    .array(
      z.string({ message: "Organizație invalidă" }).min(1, "Organizație invalidă"),
      { message: "Lista de organizații este invalidă" },
    )
    .min(1, "Selectează cel puțin o organizație"),
});
