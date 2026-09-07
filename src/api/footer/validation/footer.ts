import { z } from "zod";

/**
 * Platforms the footer can link to. An enum rather than an uploaded logo: the
 * icon is part of the site's design, and the editor only supplies the address.
 */
export const KNOWN_PLATFORMS = [
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "github",
] as const;

/** `other` is any network without a built-in icon; it supplies its own name. */
export const SOCIAL_PLATFORMS = [...KNOWN_PLATFORMS, "other"] as const;

export type KnownPlatform = (typeof KNOWN_PLATFORMS)[number];
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Editors type `facebook.com/crestem` as often as the full address, so a missing
 * scheme is completed rather than refused. A site path (`/facebook`) still is:
 * a social profile lives on another host, and prefixing that would produce
 * nonsense.
 */
const profileUrl = z
  .string({ message: "Adresa este obligatorie" })
  .trim()
  .min(1, "Adresa este obligatorie")
  .refine((url) => !url.startsWith("/"), {
    message: "Adresa profilului trebuie să fie una externă, nu o cale din site",
  })
  .transform((url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`));

const knownSocial = z.strictObject({
  platform: z.enum(KNOWN_PLATFORMS, { message: "Platformă necunoscută" }),
  url: profileUrl,
});

const customSocial = z.strictObject({
  platform: z.literal("other"),
  label: z
    .string({ message: "Numele rețelei este obligatoriu" })
    .trim()
    .min(1, "Numele rețelei este obligatoriu"),
  url: profileUrl,
});

const social = z.discriminatedUnion("platform", [knownSocial, customSocial]);

export const updateFooterSchema = z.strictObject({
  /**
   * HTML from the same TipTap surface the page builder uses. Sanitised on the
   * frontend at the schema boundary and again before rendering; stored here as
   * an opaque string.
   */
  description: z.string().default(""),
  copyright: z.string().trim().default(""),
  socials: z
    .array(social)
    .default([])
    // Only the built-in platforms are one-per-footer; "other" is a free slot and
    // may appear as often as the editor needs.
    .refine(
      (items) => {
        const known = items
          .map((item) => item.platform)
          .filter((platform) => platform !== "other");
        return new Set(known).size === known.length;
      },
      { message: "Fiecare platformă poate apărea o singură dată" },
    ),
});

export type UpdateFooterInput = z.infer<typeof updateFooterSchema>;
