import type { Core } from "@strapi/strapi";

const DOMAINS = [
  "Agricultură",
  "Educație",
  "Cultură",
  "Sport/ Timp liber",
  "Mediu/ Ecologie",
  "Civic",
  "Dezvoltare/ Turism",
  "Social/ Caritabil",
  "Sănătate",
  "Etnic",
  "Tineret",
  "Asociații religioase",
  "Asociații profesionale",
  "Asociații de proprietari",
  "Obști Silvice",
];

export async function seedDomains(strapi: Core.Strapi) {
  for (const name of DOMAINS) {
    const existing = await strapi.db
      .query("api::domain.domain")
      .findOne({ where: { name } });

    if (existing) continue;

    await strapi.db.query("api::domain.domain").create({ data: { name } });
    strapi.log.info(`[bootstrap] Created domain "${name}".`);
  }
}
