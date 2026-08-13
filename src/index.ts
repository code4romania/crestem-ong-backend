import type { Core } from "@strapi/strapi";

import { seedLocalities } from "./utils/seed-localities";

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
    "api::auth.auth.me",
    "api::auth.auth.registerMentor",
    "api::auth.auth.resendMentorInvite",
    "api::auth.auth.changePassword",
    "api::program.program.list",
    "api::program.program.detail",
    "api::program.program.stats",
    "api::program.program.createOne",
    "api::program.program.updateOne",
    "api::program.program.deleteOne",
    "api::program.program.assignMentors",
    "api::program.program.removeMentors",
    "api::program.program.mentors",
    "api::program.program.ongs",
    "api::program.program.assignOngs",
    "api::program.program.removeOngs",
    "api::program.program.assignPhaseEvaluation",
    "api::program.program.removePhaseEvaluation",
    "api::ong.ong.evaluations",
    "api::ong.ong.evaluationDetail",
    "api::ong.ong.list",
    "api::ong.ong.listActive",
    "api::ong.ong.detail",
    "api::ong.ong.deleteOne",
    "api::mentor.mentor.listActive",
  ],
  "ngo-admin": [
    "api::auth.auth.me",
    "api::auth.auth.changePassword",
    "api::evaluation.evaluation.myOngs",
    "api::auth.auth.registerMember",
    "api::auth.auth.resendMemberInvite",
    "api::ong.ong.members",
    "api::program.program.mentors",
    "api::report.report.list",
    "api::report.report.current",
    "api::report.report.start",
    "api::report.report.addMembers",
    "api::report.report.members",
    "api::report.report.detail",
    "api::report.report.finishOne",
    "api::report.report.deleteOne",
    "api::conversation.conversation.list",
    "api::conversation.conversation.messages",
    "api::conversation.conversation.sendMessage",
  ],
  "ngo-member": [
    "api::auth.auth.me",
    "api::auth.auth.changePassword",
    "api::evaluation.evaluation.myOngs",
    "api::evaluation.evaluation.myEvaluations",
    "api::evaluation.evaluation.current",
    "api::evaluation.evaluation.detail",
    "api::evaluation.evaluation.updateOne",
    "api::evaluation.evaluation.finish",
  ],
  mentor: [
    "api::auth.auth.me",
    "api::auth.auth.changePassword",
    "api::conversation.conversation.listForMentor",
    "api::conversation.conversation.messagesForMentor",
    "api::conversation.conversation.sendMessageForMentor",
  ],
  individual: ["api::auth.auth.me", "api::auth.auth.changePassword"],
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
    await seedLocalities(strapi);
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
  const roles = await strapi.db
    .query("plugin::users-permissions.role")
    .findMany();

  for (const role of roles) {
    const actions = ROLE_PERMISSIONS[role.type] ?? [];

    for (const action of actions) {
      const existing = await strapi.db
        .query("plugin::users-permissions.permission")
        .findOne({ where: { action, role: role.id } });

      if (existing) continue;

      await strapi.db
        .query("plugin::users-permissions.permission")
        .create({ data: { action, role: role.id } });

      strapi.log.info(
        `[bootstrap] Granted "${action}" to role "${role.type}".`,
      );
    }

    const stale = await strapi.db
      .query("plugin::users-permissions.permission")
      .findMany({
        where: {
          role: role.id,
          action: { $startsWith: "api::" },
          $not: { action: { $in: actions } },
        },
      });

    for (const permission of stale) {
      await strapi.db
        .query("plugin::users-permissions.permission")
        .delete({ where: { id: permission.id } });

      strapi.log.info(
        `[bootstrap] Revoked "${permission.action}" from role "${role.type}" (not in code matrix).`,
      );
    }
  }

  for (const roleType of Object.keys(ROLE_PERMISSIONS)) {
    if (!roles.some((role) => role.type === roleType)) {
      strapi.log.warn(
        `[bootstrap] Role "${roleType}" not found; skipping permission grants.`,
      );
    }
  }
}
