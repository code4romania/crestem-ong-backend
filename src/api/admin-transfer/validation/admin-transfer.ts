import { z } from "zod";

export { activateAccountSchema as acceptNewAccountSchema } from "../../auth/validation/auth";

const targetSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("member"),
    memberDocumentId: z
      .string({ message: "Alege un membru" })
      .trim()
      .min(1, "Alege un membru"),
  }),
  z.object({
    mode: z.literal("email"),
    nume: z
      .string({ message: "Numele persoanei este obligatoriu" })
      .trim()
      .min(3, "Numele trebuie să aibă minim 3 caractere"),
    email: z
      .string({ message: "Adresa de email este obligatorie" })
      .trim()
      .toLowerCase()
      .pipe(z.email("Adresă de email invalidă")),
  }),
]);

/** FDSC Admin: no password (US-5 BR3). */
export const fdscCreateTransferSchema = targetSchema;

/** ONG admin: current password confirms the initiation (US-1 BR2). */
export const createTransferSchema = z.intersection(
  targetSchema,
  z.object({
    password: z
      .string({ message: "Parola este obligatorie" })
      .min(1, "Parola este obligatorie"),
  }),
);

export const tokenSchema = z.object({
  token: z
    .string({ message: "Tokenul este obligatoriu" })
    .trim()
    .min(1, "Tokenul este obligatoriu"),
});
