import { z } from "zod";

export const createMeetingSchema = z.object({
  subiect: z
    .string()
    .trim()
    .min(1, "Subiectul întâlnirii este obligatoriu")
    .max(200, "Subiectul întâlnirii este prea lung"),
  dataOra: z
    .string()
    .trim()
    .min(1, "Data și ora sunt obligatorii")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Data și ora sunt invalide"),
  format: z.enum(["online", "fata_in_fata"], { message: "Formatul este invalid" }),
  linkIntalnire: z.string().trim().max(500).optional().nullable(),
  mentor: z.string().trim().min(1, "Persoana resursă este obligatorie"),
  program: z.string().trim().min(1).optional().nullable(),
  activityType: z.string().trim().min(1).optional().nullable(),
  dimensiuni: z.array(z.string()).optional(),
  comentarii: z.string().trim().max(2000).optional().nullable(),
});
