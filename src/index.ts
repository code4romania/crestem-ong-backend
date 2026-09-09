import type { Core } from "@strapi/strapi";

import { seedLocalities } from "./utils/seed-localities";
import { seedDomains } from "./utils/seed-domains";
import { seedMenus } from "./utils/seed-menus";
import { seedFooter } from "./utils/seed-footer";
import { migratePageStare } from "./utils/migrate-page-stare";

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
    type: "editor-fdsc",
    name: "Editor FDSC",
    description:
      "Personal FDSC cu acces identic cu Admin FDSC, fără administrarea utilizatorilor.",
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

/**
 * Everything the administrator reaches. `editor-fdsc` is derived from it below:
 * the two FDSC staff accounts differ by exactly one action.
 */
const SUPER_ADMIN_PERMISSIONS = [
    "api::dashboard.dashboard.fdsc",
    "api::auth.auth.me",
    "api::auth.auth.registerMentor",
    "api::auth.auth.resendMentorInvite",
    "api::auth.auth.registerStaff",
    "api::auth.auth.changePassword",
    "api::auth.auth.deleteAccount",
    "api::auth.auth.requestEmailChange",
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
    "api::program.program.assignOngMentors",
    "api::program.program.removeOngMentors",
    "api::program.program.assignPhaseEvaluation",
    "api::program.program.removePhaseEvaluation",
    "api::ong.ong.overview",
    "api::ong.ong.evaluations",
    "api::ong.ong.evaluationDetail",
    "api::ong.ong.fdscReports",
    "api::ong.ong.createFdscReport",
    "api::ong.ong.deleteFdscReport",
    "api::ong.ong.mentors",
    "api::ong.ong.meetings",
    "plugin::upload.content-api.upload",
    "api::ong.ong.list",
    "api::ong.ong.listActive",
    "api::ong.ong.detail",
    "api::ong.ong.deleteOne",
    "api::mentor.mentor.listActive",
    "api::public-person.public-person.list",
    // Reading the menus is public (the routes set `auth: false`); only the
    // rewrite needs granting, and the editor keeps it.
    "api::menu.menu.updateItems",
    "api::footer.footer.updateOne",
    "api::page.page.list",
    "api::page.page.options",
    "api::page.page.detail",
    "api::page.page.createOne",
    "api::page.page.updateOne",
    "api::page.page.deleteOne",
    "api::page.page.publishOne",
    "api::page.page.unpublishOne",
    "api::media-asset.media-asset.list",
    "api::media-asset.media-asset.detail",
    "api::media-asset.media-asset.createOne",
    "api::media-asset.media-asset.updateOne",
    "api::media-asset.media-asset.deleteOne",
    "api::media-asset.media-asset.replaceFile",
    "api::media-tag.media-tag.list",
    "api::media-tag.media-tag.createOne",
    "api::public-person.public-person.programs",
    "api::admin-user.admin-user.list",
    "api::admin-user.admin-user.findOne",
    "api::admin-user.admin-user.update",
    // The platform-wide "Evaluări" screen, one action per tab: responses and
    // rounds. Read-only, so the editor keeps them too.
    "api::evaluation.admin-evaluation.list",
    "api::report.admin-report.list",
    // The options behind that screen's multi-select filters.
    "api::ong.filter-options.ongs",
    "api::ong.filter-options.programs",
    "plugin::upload.content-api.upload",
];

/**
 * User administration is what the editor does not get. It keeps the read-only
 * `admin-user` actions because "Persoane resursă" lists mentors through them —
 * narrowed to mentor targets by `api/admin-user/utils/access.ts` — but creating
 * an account and editing one both stay with the administrator.
 */
const EDITOR_FDSC_DENIED_ACTIONS = [
  "api::auth.auth.registerStaff",
  "api::auth.auth.registerMentor",
  "api::auth.auth.resendMentorInvite",
  "api::admin-user.admin-user.update",
];

const EDITOR_FDSC_PERMISSIONS = SUPER_ADMIN_PERMISSIONS.filter(
  (action) => !EDITOR_FDSC_DENIED_ACTIONS.includes(action),
);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  "super-admin": SUPER_ADMIN_PERMISSIONS,
  "editor-fdsc": EDITOR_FDSC_PERMISSIONS,
  "ngo-admin": [
    "api::dashboard.dashboard.ong",
    "api::auth.auth.me",
    "api::auth.auth.changePassword",
    // Granted deliberately even though BR-32 blocks the deletion itself: the
    // handler must be reachable so the contact person gets the Romanian
    // explanation of the steps available to them, not a bare 403.
    "api::auth.auth.deleteAccount",
    "api::evaluation.evaluation.myOngs",
    "api::auth.auth.registerMember",
    "api::auth.auth.resendMemberInvite",
    "api::ong.ong.members",
    "api::ong.ong.removeMember",
    "api::ong.ong.me",
    "api::ong.ong.updateMe",
    // "Business rules.txt": `Șterge ONG` sits in the Admin ONG's own Acțiuni
    // menu, with no approval step — and BR-32 dead-ends them without it. The
    // permission only opens the route; the handler still refuses any
    // organization the caller does not belong to, and refuses it with the
    // "does not exist" answer so the endpoint cannot be used to enumerate ids.
    "api::ong.ong.deleteOne",
    "api::ong.ong.joinRequests",
    "api::ong.ong.acceptJoinRequest",
    "api::ong.ong.rejectJoinRequest",
    "plugin::upload.content-api.upload",
    "api::program.program.mentors",
    "api::program.program.ongMentors",
    "api::ong.ong.detail",
    "api::ong.ong.mentors",
    "api::ong.ong.meetings",
    "api::report.report.list",
    "api::report.report.current",
    "api::report.report.fdscReports",
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
    "api::auth.auth.deleteAccount",
    "api::auth.auth.requestEmailChange",
    "api::evaluation.evaluation.myOngs",
    "api::evaluation.evaluation.leaveOng",
    "api::evaluation.evaluation.myEvaluations",
    "api::evaluation.evaluation.ongRounds",
    "api::evaluation.evaluation.ongMentors",
    "api::evaluation.evaluation.current",
    "api::evaluation.evaluation.detail",
    "api::evaluation.evaluation.updateOne",
    "api::evaluation.evaluation.finish",
    "api::ong.ong.joinable",
    "api::ong.ong.createJoinRequest",
  ],
  mentor: [
    "api::dashboard.dashboard.mentor",
    "api::auth.auth.me",
    "api::auth.auth.changePassword",
    "api::auth.auth.deleteAccount",
    "api::auth.auth.requestEmailChange",
    "api::conversation.conversation.listForMentor",
    "api::conversation.conversation.messagesForMentor",
    "api::conversation.conversation.sendMessageForMentor",
    "api::ong.ong.ongsForMentor",
    "api::ong.ong.programsForMentor",
    "api::ong.ong.detail",
    "api::ong.ong.overview",
    "api::ong.ong.evaluations",
    "api::ong.ong.evaluationDetail",
    "api::ong.ong.fdscReports",
    "api::ong.ong.meetingsForMentor",
    "api::ong.ong.createMeetingForMentor",
    "api::ong.ong.updateMeetingForMentor",
    "api::ong.ong.cancelMeetingForMentor",
    "api::ong.ong.completeMeetingForMentor",
    "api::ong.ong.uploadMeetingReportForMentor",
    "api::activity-type.activity-type.list",
    "api::mentor.mentor.me",
    "api::mentor.mentor.updateMe",
    "plugin::upload.content-api.upload",
  ],
  individual: [
    "api::auth.auth.me",
    "api::auth.auth.changePassword",
    "api::auth.auth.deleteAccount",
    "api::auth.auth.requestEmailChange",
    "api::ong.ong.joinable",
    "api::ong.ong.createJoinRequest",
    "api::individual.individual.me",
    "api::individual.individual.updateMe",
  ],
};

/**
 * Actions everyone may call, anonymous included. Appended to every role rather
 * than granted to `public` alone: a permission on the Public role does not
 * carry over to authenticated ones, so a signed-in user would be refused a page
 * an anonymous visitor can read.
 */
const PUBLIC_READ_ACTIONS = ["api::page.page.byPath"];

for (const actions of Object.values(ROLE_PERMISSIONS)) {
  actions.push(...PUBLIC_READ_ACTIONS);
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  async register({ strapi }: { strapi: Core.Strapi }) {
    assertActivationLinkGuard();
    // Has to happen here: `bootstrap()` is already too late, see the file.
    await migratePageStare(strapi);
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureAppRoles(strapi);
    await ensureRolePermissions(strapi);
    await ensurePublicPermissions(strapi);
    await backfillAccountStatus(strapi);
    await seedLocalities(strapi);
    await seedDomains(strapi);
    await seedMenus(strapi);
    await seedFooter(strapi);
  },
};

/**
 * Refuses to start with activation links exposed on a production deployment.
 * A no-op unless the flag is on.
 */
function assertActivationLinkGuard() {
  if (process.env.DEV_EXPOSE_ACTIVATION_LINK !== "true") return;
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV;
  if (appEnv === "production") {
    throw new Error(
      "DEV_EXPOSE_ACTIVATION_LINK nu poate fi activat în producție. " +
        "Pe staging setează APP_ENV=staging.",
    );
  }
  console.warn(
    `[register] DEV_EXPOSE_ACTIVATION_LINK activ (APP_ENV=${appEnv}). ` +
      "Linkurile de activare sunt expuse prin API. Dezactivează înainte de producție.",
  );
}

/**
 * Accounts created before `accountStatus` was added to the user schema kept a
 * NULL value — Strapi only applies enum defaults on insert. Anything checking
 * `accountStatus === "active"` (changePassword, refresh-token rotation) rejects
 * those users, so bring them up to the schema default. Idempotent.
 */
async function backfillAccountStatus(strapi: Core.Strapi) {
  const legacy = await strapi.db
    .query("plugin::users-permissions.user")
    .findMany({ where: { accountStatus: null }, select: ["id"] });

  if (!legacy.length) return;

  await strapi.db.query("plugin::users-permissions.user").updateMany({
    where: { id: { $in: legacy.map((user: { id: number }) => user.id) } },
    data: { accountStatus: "active" },
  });

  strapi.log.info(
    `[bootstrap] Backfilled accountStatus="active" for ${legacy.length} legacy user(s).`,
  );
}

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

/**
 * Both built-in users-permissions roles: an anonymous visitor sits on
 * `public`, but any signed-in user without an app role (or whose token simply
 * resolves to Strapi's default) sits on `authenticated`. Granting only
 * `public` leaves the latter with a 403 on a route meant to be readable by
 * everyone.
 */
const PUBLICLY_GRANTED_ROLE_TYPES = ["public", "authenticated"] as const;

async function ensurePublicPermissions(strapi: Core.Strapi) {
  for (const roleType of PUBLICLY_GRANTED_ROLE_TYPES) {
    const role = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: roleType } });

    if (!role) {
      strapi.log.warn(`[bootstrap] Role "${roleType}" not found; skipping public grants.`);
      continue;
    }

    for (const action of PUBLIC_READ_ACTIONS) {
      const existing = await strapi.db
        .query("plugin::users-permissions.permission")
        .findOne({ where: { action, role: role.id } });

      if (existing) continue;

      await strapi.db
        .query("plugin::users-permissions.permission")
        .create({ data: { action, role: role.id } });

      strapi.log.info(`[bootstrap] Granted "${action}" to role "${roleType}".`);
    }
  }
}
