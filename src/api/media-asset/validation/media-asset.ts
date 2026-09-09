import { z } from "zod";

const titlu = z
  .string({ message: "Titlul este obligatoriu" })
  .trim()
  .min(1, "Titlul este obligatoriu")
  .max(200, "Titlul poate avea cel mult 200 de caractere");

const descriere = z
  .string()
  .trim()
  .max(1000, "Descrierea poate avea cel mult 1000 de caractere");

const altText = z
  .string()
  .trim()
  .max(500, "Textul alternativ poate avea cel mult 500 de caractere");

const eticheteIds = z.array(z.number().int().positive());

export const createMediaAssetSchema = z.strictObject({
  fisierId: z.number({ message: "Fișierul este obligatoriu" }).int().positive(),
  titlu,
  descriere: descriere.optional(),
  eticheteIds: eticheteIds.optional(),
});

export const updateMediaAssetSchema = z.strictObject({
  titlu: titlu.optional(),
  descriere: descriere.nullable().optional(),
  eticheteIds: eticheteIds.optional(),
  altText: altText.optional(),
});

export const cleanupOrphanFileSchema = z.strictObject({
  fisierId: z.number().int().positive(),
});

export type CreateMediaAssetInput = z.infer<typeof createMediaAssetSchema>;
export type UpdateMediaAssetInput = z.infer<typeof updateMediaAssetSchema>;
export type CleanupOrphanFileInput = z.infer<typeof cleanupOrphanFileSchema>;
