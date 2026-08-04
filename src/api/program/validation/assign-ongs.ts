import { z } from "zod";

export const assignOngsSchema = z.object({
  program: z
    .string({ message: "Programul este obligatoriu" })
    .min(1, "Programul este obligatoriu"),
  ongs: z
    .array(
      z.object({
        ong: z
          .string({ message: "Organizație invalidă" })
          .min(1, "Organizație invalidă"),
        report: z
          .string({ message: "Evaluare invalidă" })
          .min(1, "Evaluare invalidă")
          .optional(),
      }),
      { message: "Lista de organizații este invalidă" },
    )
    .min(1, "Selectează cel puțin o organizație"),
});

export const removeOngsSchema = z.object({
  program: z
    .string({ message: "Programul este obligatoriu" })
    .min(1, "Programul este obligatoriu"),
  ongs: z
    .array(
      z
        .string({ message: "Organizație invalidă" })
        .min(1, "Organizație invalidă"),
      { message: "Lista de organizații este invalidă" },
    )
    .min(1, "Selectează cel puțin o organizație"),
});

export const assignPhaseEvaluationSchema = z.object({
  ong: z
    .string({ message: "Organizația este obligatorie" })
    .min(1, "Organizația este obligatorie"),
  report: z
    .string({ message: "Evaluarea este obligatorie" })
    .min(1, "Evaluarea este obligatorie"),
});
