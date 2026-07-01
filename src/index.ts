import type { Core } from "@strapi/strapi";

/**
 * Application-level users-permissions roles, beyond the built-in
 * `public` and `authenticated`. Identified by their `type` (a stable
 * slug used in code); `name`/`description` are for the admin panel only.
 */
const APP_ROLES = [
  {
    type: "super-admin",
    name: "Super Admin",
    description: "Platform super administrator with full access.",
  },
  {
    type: "ngo-admin",
    name: "NGO Admin",
    description: "Administrates a single organization and its data.",
  },
  {
    type: "ngo-member",
    name: "NGO Member",
    description: "Member within an organization.",
  },
  {
    type: "mentor",
    name: "Mentor",
    description: "Supervises one or more organizations.",
  },
  {
    type: "individual",
    name: "Individual",
    description:
      "A single independent user not affiliated with an organization.",
  },
];

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureAppRoles(strapi);
  },
};

/**
 * Creates any missing application roles. Idempotent: existing roles
 * (matched by `type`) are left untouched, so it is safe on every boot.
 */
async function ensureAppRoles(strapi: Core.Strapi) {
  for (const role of APP_ROLES) {
    const existing = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: role.type } });

    if (existing) continue;

    await strapi.db
      .query("plugin::users-permissions.role")
      .create({ data: role });
    strapi.log.info(
      `[bootstrap] Created users-permissions role "${role.type}".`,
    );
  }
}
