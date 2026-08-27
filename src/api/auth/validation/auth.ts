/**
 * Validation schemas for the `auth` API.
 *
 * Fields are derived from:
 *  - users-permissions user content-type (account: nume, email, password, telefon)
 *  - ong content-type (organization: name, cui, judet, localitate, acordTermeniSiConditii)
 */

import { z } from "zod";

import { ngoRoleSchema } from "../../../utils/ngo-role";
import { DIMENSIONS } from "../../../constants/dimensions";

const DIMENSION_KEYS = DIMENSIONS.map((dimension) => dimension.key);

export const registerNgoSchema = z.object({
  // --- Account (users-permissions user) ---
  nume: z
    .string({ message: "Numele persoanei este obligatoriu" })
    .trim()
    .min(3, "Numele trebuie să aibă minim 3 caractere"),
  email: z
    .email("Adresă de email invalidă")
    .lowercase()
    .min(6, "Adresa de email este prea scurtă")
    .refine(
      async (email) =>
        !(await strapi.db
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: { $eqi: email } } })),
      "Există deja un cont cu acest email",
    ),
  password: z
    .string({ message: "Parola este obligatorie" })
    .min(8, "Parola trebuie să aibă minim 8 caractere")
    .regex(/[A-Z]/, "Parola trebuie să conțină cel puțin o literă mare")
    .regex(/[0-9]/, "Parola trebuie să conțină cel puțin o cifră")
    .regex(
      /[^A-Za-z0-9]/,
      "Parola trebuie să conțină cel puțin un caracter special",
    ),
  telefon: z
    .string()
    .trim()
    .min(8, "Numărul de telefon este invalid")
    .optional(),

  // --- Organization (ong) ---
  numeOng: z
    .string({ message: "Numele organizației este obligatoriu" })
    .trim()
    .min(1, "Numele organizației este obligatoriu"),
  cui: z
    .string({ error: "C.U.I.-ul este obligatoriu" })
    .trim()
    .min(1, "C.U.I. invalid")
    .refine(
      async (cui) =>
        !(await strapi.db
          .query("api::ong.ong")
          .findOne({ where: { cui: { $eqi: cui } } })),
      "Există deja o organizație cu acest C.U.I.",
    ),
  judet: z
    .string({ message: "Județul este obligatoriu" })
    .trim()
    .min(1, "Județul selectat este invalid"),
  localitate: z
    .string({ message: "Localitatea este obligatorie" })
    .trim()
    .min(1, "Localitatea selectată este invalidă"),
  acordTermeniSiConditii: z.literal(true, {
    message: "Trebuie să accepți termenii și condițiile",
  }),
});

const passwordSchema = z
  .string({ message: "Parola este obligatorie" })
  .min(8, "Parola trebuie să aibă minim 8 caractere")
  .regex(/[A-Z]/, "Parola trebuie să conțină cel puțin o literă mare")
  .regex(/[0-9]/, "Parola trebuie să conțină cel puțin o cifră")
  .regex(
    /[^A-Za-z0-9]/,
    "Parola trebuie să conțină cel puțin un caracter special",
  );

const confirmedPasswordSchema = z.string({
  message: "Confirmarea parolei este obligatorie",
});

export const registerIndividualSchema = z.object({
  // --- Account (users-permissions user) ---
  nume: z
    .string({ message: "Numele persoanei este obligatoriu" })
    .trim()
    .min(3, "Numele trebuie să aibă minim 3 caractere"),
  email: z
    .email("Adresă de email invalidă")
    .lowercase()
    .min(6, "Adresa de email este prea scurtă")
    .refine(
      async (email) =>
        !(await strapi.db
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: { $eqi: email } } })),
      "Există deja un cont cu acest email",
    ),
  password: passwordSchema,
  telefon: z
    .string()
    .trim()
    .min(8, "Numărul de telefon este invalid")
    .optional(),
  acordTermeniSiConditii: z.literal(true, {
    message: "Trebuie să accepți termenii și condițiile",
  }),
});

const inviteSchema = z.object({
  nume: z
    .string({ message: "Numele persoanei este obligatoriu" })
    .trim()
    .min(3, "Numele trebuie să aibă minim 3 caractere"),
  email: z
    .email("Adresă de email invalidă")
    .lowercase()
    .min(6, "Adresa de email este prea scurtă")
    .refine(
      async (email) =>
        !(await strapi.db
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: { $eqi: email } } })),
      "Există deja un cont cu acest email",
    ),
  telefon: z
    .string()
    .trim()
    .min(8, "Numărul de telefon este invalid")
    .optional(),
});

export const registerMentorSchema = inviteSchema.extend({
  bio: z
    .string()
    .trim()
    .max(1000, "Bio-ul poate avea maxim 1000 de caractere")
    .optional(),
  avatar: z.number().int().positive().optional(),
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
/**
 * Members belong to an organization, so they carry a role there. Mentors do not.
 * Unlike the accept-join-request flow (which reuses `ngoRoleSchema` as required),
 * the NGO admin can leave this blank when inviting a member directly.
 */
export const registerMemberSchema = inviteSchema.extend({
  rol: z
    .string()
    .trim()
    .max(100, "Rolul în organizație este prea lung")
    .optional()
    .transform((val) => (val ? val : undefined)),
});
/** FDSC staff accounts (super-admin / editor-fdsc) — nume + email only, no org. */
export const registerStaffSchema = inviteSchema.extend({
  role: z.enum(["super-admin", "editor-fdsc"], { message: "Rol invalid" }),
});

export const activateAccountSchema = z
  .object({
    token: z
      .string({ message: "Tokenul este obligatoriu" })
      .trim()
      .min(1, "Tokenul este obligatoriu"),
    password: passwordSchema,
    confirmedPassword: confirmedPasswordSchema,
  })
  .refine((data) => data.password === data.confirmedPassword, {
    message: "Parolele nu coincid",
    path: ["confirmedPassword"],
  });

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ message: "Refresh tokenul este obligatoriu" })
    .trim()
    .min(1, "Refresh tokenul este obligatoriu"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .email("Adresă de email invalidă")
    .lowercase()
    .min(6, "Adresa de email este prea scurtă"),
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string({ message: "Tokenul este obligatoriu" })
      .trim()
      .min(1, "Tokenul este obligatoriu"),
    password: passwordSchema,
    confirmedPassword: confirmedPasswordSchema,
  })
  .refine((data) => data.password === data.confirmedPassword, {
    message: "Parolele nu coincid",
    path: ["confirmedPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ message: "Parola actuală este obligatorie" })
      .min(1, "Parola actuală este obligatorie"),
    password: passwordSchema,
    confirmedPassword: confirmedPasswordSchema,
  })
  .refine((data) => data.password === data.confirmedPassword, {
    message: "Parolele nu coincid",
    path: ["confirmedPassword"],
  });

export const requestEmailChangeSchema = z.object({
  currentPassword: z
    .string({ message: "Parola actuală este obligatorie" })
    .min(1, "Parola actuală este obligatorie"),
  email: z
    .email("Adresă de email invalidă")
    .lowercase()
    .min(6, "Adresa de email este prea scurtă")
    .refine(
      async (email) =>
        !(await strapi.db
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: { $eqi: email } } })),
      "Există deja un cont cu această adresă de email",
    ),
});

export const confirmEmailChangeSchema = z.object({
  token: z
    .string({ message: "Tokenul este obligatoriu" })
    .trim()
    .min(1, "Tokenul este obligatoriu"),
});
