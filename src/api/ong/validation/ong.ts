/**
 * Validation schema for `PATCH /api/ongs/me` — Nivel 2 (optional additional info) fields only.
 */

import { z } from "zod";

export const updateMyOngSchema = z.object({
  logo: z.number().int().positive().nullable().optional(),
  domeniuPrincipal: z
    .string()
    .trim()
    .length(24, "Domeniul principal selectat este invalid")
    .optional(),
  domeniuSecundar: z
    .string()
    .trim()
    .length(24, "Domeniul secundar selectat este invalid")
    .optional(),
  website: z
    .string()
    .trim()
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url({ protocol: /^https?$/, error: "Adresa website-ului este invalidă" }))
    .optional(),
  socialMedia: z.string().trim().optional(),
  descriere: z.string().trim().max(2000, "Descrierea este prea lungă").optional(),
  cuvinteCheie: z.string().trim().optional(),
});
