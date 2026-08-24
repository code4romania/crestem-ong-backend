import { z } from "zod";

/**
 * Typed confirmation required by BR-25. Kept in a standalone module rather than
 * `validation/auth.ts` because the frontend copy quotes the same word.
 */
export const DELETE_CONFIRMATION_WORD = "STERGE";

export const deleteAccountSchema = z.object({
  currentPassword: z
    .string({ message: "Parola actuală este obligatorie" })
    .min(1, "Parola actuală este obligatorie"),
  confirmare: z.literal(DELETE_CONFIRMATION_WORD, {
    message: `Scrie ${DELETE_CONFIRMATION_WORD} pentru a confirma ștergerea contului`,
  }),
});
