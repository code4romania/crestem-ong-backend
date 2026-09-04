import type { Core } from "@strapi/strapi";

/**
 * The footer's left side. Seeded so the single type always exists — the API only
 * updates it, and the public footer would otherwise render half-empty on a fresh
 * environment. Text mirrors the current design; the editor owns it afterwards.
 */
const FOOTER = {
  description:
    "<p>Platforma de creștere pentru organizațiile neguvernamentale din România.</p>",
  copyright: "© 2026 Crestem. Toate drepturile rezervate.",
  socials: [],
};

export async function seedFooter(strapi: Core.Strapi) {
  const existing = await strapi.documents("api::footer.footer").findFirst();
  if (existing) return;

  await strapi.documents("api::footer.footer").create({ data: FOOTER as any });
  strapi.log.info("[bootstrap] Created footer content.");
}
