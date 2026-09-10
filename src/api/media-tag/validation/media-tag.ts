import { z } from "zod";

export const createMediaTagSchema = z.strictObject({
  nume: z
    .string({ message: "Numele etichetei este obligatoriu" })
    .trim()
    .min(1, "Numele etichetei este obligatoriu")
    .max(50, "Numele etichetei poate avea cel mult 50 de caractere"),
});

export type CreateMediaTagInput = z.infer<typeof createMediaTagSchema>;
