import { z } from "zod";

export const assignOngMentorsSchema = z.object({
  program: z
    .string({ message: "Programul este obligatoriu" })
    .min(1, "Programul este obligatoriu"),
  ong: z
    .string({ message: "Organizația este obligatorie" })
    .min(1, "Organizația este obligatorie"),
  mentors: z
    .array(
      z.string({ message: "Persoană resursă invalidă" }).min(1, "Persoană resursă invalidă"),
      { message: "Lista de persoane resursă este invalidă" },
    )
    .min(1, "Selectează cel puțin o persoană resursă"),
});
