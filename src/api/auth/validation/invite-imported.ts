import { z } from "zod";

/**
 * Fails closed: the run is driven by hand from Postman, where a typo must not
 * become a mass send. Unknown keys are rejected rather than stripped (`email`
 * for `emails`, `dryrun` for `dryRun`), and the body has to name its audience —
 * either `emails` or `all: true` — so an empty or unparsed body sends nothing.
 *
 * `.toLowerCase()` rather than zod's `.lowercase()`: the latter is a format
 * check, not a transform, so an address pasted from a spreadsheet with a
 * capital letter would be rejected instead of normalized.
 */
export const inviteImportedSchema = z
  .strictObject(
    {
      emails: z
        .array(
          z
            .email("Adresă de email invalidă")
            .transform((value) => value.toLowerCase()),
          { message: "Câmpul emails trebuie să fie o listă de adrese" },
        )
        // An empty array must not fall through to "send to everyone": a frontend
        // that filtered a list down to nothing would trigger the mass send.
        .min(1, "Lista de emailuri nu poate fi goală")
        .max(500, "Maxim 500 de adrese per apel")
        .optional(),
      // Explicit opt-in for every account; `false` is not accepted.
      all: z.literal(true).optional(),
      limit: z
        .number()
        .int("Limita trebuie să fie număr întreg")
        .positive("Limita trebuie să fie pozitivă")
        .max(1000, "Limita nu poate depăși 1000")
        .optional(),
      // Cursor for tranches: pass the `lastId` of the previous call.
      afterId: z
        .number()
        .int("afterId trebuie să fie număr întreg")
        .nonnegative("afterId nu poate fi negativ")
        .optional(),
      dryRun: z.boolean().optional().default(false),
      batchSize: z
        .number()
        .int("Dimensiunea lotului trebuie să fie număr întreg")
        .min(1, "Dimensiunea lotului trebuie să fie cel puțin 1")
        .max(50, "Dimensiunea lotului nu poate depăși 50")
        .optional()
        .default(10),
      batchDelayMs: z
        .number()
        .int("Pauza dintre loturi trebuie să fie număr întreg")
        .min(0, "Pauza dintre loturi nu poate fi negativă")
        .max(10000, "Pauza dintre loturi nu poate depăși 10000 ms")
        .optional()
        .default(1000),
    },
    {
      error: (issue) =>
        issue.code === "unrecognized_keys"
          ? `Câmp necunoscut: ${issue.keys.join(", ")}`
          : undefined,
    },
  )
  .refine((body) => (body.emails !== undefined) !== (body.all === true), {
    message: "Trimite fie emails, fie all: true",
  });

export type InviteImportedOptions = z.output<typeof inviteImportedSchema>;
