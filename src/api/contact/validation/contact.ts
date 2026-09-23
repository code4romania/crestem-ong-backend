import { z } from "zod";

export const CONTACT_STATUSES = ["new", "in_progress", "closed"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * Payloadul rutei publice. `consent` trebuie să fie literalmente `true`:
 * bifa e obligatorie, iar momentul acordului (`consentedAt`) îl pune
 * controllerul din ceasul serverului — o dată venită din browser n-ar
 * dovedi nimic.
 *
 * `website` e honeypot-ul, dar nu apare aici: controllerul îl citește din
 * body și decide *înaintea* acestei validări (răspuns 200 fără insert),
 * apoi îl scoate din obiect înainte de a-l trece prin schemă — un 400 pe
 * un câmp necunoscut i-ar spune botului exact ce l-a dat de gol.
 */
export const submitContactSchema = z.strictObject({
  name: z
    .string({ message: "Numele este obligatoriu" })
    .trim()
    .min(1, "Numele este obligatoriu")
    .max(120, "Numele poate avea cel mult 120 de caractere"),
  email: z
    .string({ message: "Emailul este obligatoriu" })
    .trim()
    .email("Adresa de email nu este validă")
    .max(160, "Emailul poate avea cel mult 160 de caractere"),
  organization: z
    .string()
    .trim()
    .max(160, "Denumirea organizației poate avea cel mult 160 de caractere")
    .default(""),
  subject: z
    .string({ message: "Subiectul este obligatoriu" })
    .trim()
    .min(1, "Subiectul este obligatoriu")
    .max(160, "Subiectul poate avea cel mult 160 de caractere"),
  message: z
    .string({ message: "Mesajul este obligatoriu" })
    .trim()
    .min(1, "Mesajul este obligatoriu")
    .min(3, "Mesajul trebuie să aibă cel puțin 3 caractere")
    .max(5000, "Mesajul poate avea cel mult 5000 de caractere"),
  consent: z.literal(true, {
    message: "Acordul cu politica de confidențialitate este obligatoriu",
  }),
});

export type SubmitContactInput = z.infer<typeof submitContactSchema>;

export const updateContactStatusSchema = z.strictObject({
  status: z.enum(CONTACT_STATUSES, { message: "Status invalid" }),
});

export type UpdateContactStatusInput = z.infer<typeof updateContactStatusSchema>;
