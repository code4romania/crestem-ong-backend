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

const ROLE_PERMISSIONS: Record<string, string[]> = {
  "super-admin": [
    "api::auth.auth.registerMentor",
    "api::auth.auth.resendMentorInvite",
  ],
};

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
    await ensureRolePermissions(strapi);
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

async function ensureRolePermissions(strapi: Core.Strapi) {
  for (const [roleType, actions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: roleType } });

    if (!role) {
      strapi.log.warn(
        `[bootstrap] Role "${roleType}" not found; skipping permission grants.`,
      );
      continue;
    }

    for (const action of actions) {
      const existing = await strapi.db
        .query("plugin::users-permissions.permission")
        .findOne({ where: { action, role: role.id } });

      if (existing) continue;

      await strapi.db
        .query("plugin::users-permissions.permission")
        .create({ data: { action, role: role.id } });

      strapi.log.info(
        `[bootstrap] Granted "${action}" to role "${roleType}".`,
      );
    }
  }
}
