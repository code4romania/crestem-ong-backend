import { z } from "zod";

import { DIMENSIONS } from "../../../constants/dimensions";
import { stripHtml } from "../../../utils/rich-text";

const DIMENSION_KEYS = DIMENSIONS.map((dimension) => dimension.key);

/** Bio is rich-text HTML from the TipTap editor — markup doesn't count
 * against the visible-character limit. */
const bioSchema = z
  .string()
  .trim()
  .refine(
    (value) => stripHtml(value).length <= 1000,
    "Bio-ul poate avea maxim 1000 de caractere",
  )
  .optional();

/** Mentor accounts: everything from the invite form except email, which never changes here. */
export const updateMentorSchema = z.object({
  nume: z
    .string({ message: "Numele persoanei este obligatoriu" })
    .trim()
    .min(3, "Numele trebuie să aibă minim 3 caractere"),
  bio: bioSchema,
  avatar: z.number().int().positive().nullable().optional(),
  dimensiuni: z
    .array(z.string())
    .refine(
      (keys) => keys.every((key) => DIMENSION_KEYS.includes(key)),
      "Dimensiune invalidă",
    )
    .optional(),
  ariiDeExpertiza: z
    .array(z.string().trim().min(1))
    .max(20, "Poți adăuga maxim 20 de arii de expertiză")
    .optional(),
});

/** FDSC staff accounts (super-admin / editor-fdsc): only the name is editable. */
export const updateStaffSchema = z.object({
  nume: z
    .string({ message: "Numele persoanei este obligatoriu" })
    .trim()
    .min(3, "Numele trebuie să aibă minim 3 caractere"),
});

/**
 * Individual accounts: name plus an optional judet/localitate pair. If one of
 * the two is provided the other must be too — the controller then checks the
 * pair is a real county/city match via `checkCityBelongsToCounty`.
 */
export const updateIndividualSchema = z
  .object({
    nume: z
      .string({ message: "Numele persoanei este obligatoriu" })
      .trim()
      .min(3, "Numele trebuie să aibă minim 3 caractere"),
    judet: z.string().trim().min(1, "Județul selectat este invalid").optional(),
    localitate: z
      .string()
      .trim()
      .min(1, "Localitatea selectată este invalidă")
      .optional(),
  })
  .refine((data) => !!data.judet === !!data.localitate, {
    message: "Selectează atât județul cât și localitatea",
    path: ["localitate"],
  });
