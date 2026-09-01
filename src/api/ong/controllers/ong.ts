/**
 * ong controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { computeProgress } from "../../evaluation/utils/progress";
import {
  computeEvaluationScores,
  computeReportScores,
} from "../../report/utils/scores";
import { phaseOfSameProgram, programOfReport } from "../../report/utils/association";
import { isClosed } from "../../report/utils/lifecycle";
import { toDateString, todayInBucharest } from "../../../utils/date";
import { computeProgramStatus } from "../../program/utils/status";
import { pendingActivationTokens } from "../../../utils/activation";
import { isAnonymized } from "../../../utils/anonymize";
import {
  belongsToOng,
  loadUserWithOngs,
  mentorHasOng,
  requireOng,
} from "../../../utils/ong-scope";
import {
  addOngMembership,
  getNgoMemberRoles,
  removeOngMembership,
} from "../../../utils/membership";
import {
  buildActivationLink,
  exposeActivationLink,
  ACTIVATION_PATH,
} from "../../auth/utils/auth";
import { updateMyOngSchema } from "../validation/ong";
import { acceptJoinRequestSchema } from "../validation/join-request";
import { createFdscReportSchema } from "../validation/fdsc-report";
import {
  createMeetingSchema,
  createMentorMeetingSchema,
} from "../validation/meeting";
import { decorateBlock } from "../../evaluation/utils/catalog";
import { docRef } from "../../../utils/relations";
import { DIMENSIONS } from "../../../constants/dimensions";

const VALID_DIMENSION_KEYS = new Set(
  DIMENSIONS.map((dimension) => dimension.key),
);

/**
 * A mentor who deleted their account keeps their `ngo-mentor` assignment
 * (BR-34), so the assignment check alone no longer proves they can be
 * scheduled. Nothing new may be booked with them.
 */
const isDeletedMentor = async (
  strapi: any,
  mentorDocumentId: string,
): Promise<boolean> => {
  const mentor = await strapi
    .documents("plugin::users-permissions.user")
    .findOne({ documentId: mentorDocumentId });
  return isAnonymized(mentor);
};

/**
 * The mentor of a meeting, as the organization's side sees it. A mentor who
 * deleted their account keeps their meetings (BR-34) under the `Anonim
 * <documentId>` name (BR-27); `isDeleted` is what greys the row out and hides
 * the actions that would target a person who is no longer there.
 */
const meetingMentorView = (mentor: any) =>
  mentor
    ? {
        documentId: mentor.documentId,
        nume: mentor.nume,
        isDeleted: isAnonymized(mentor),
      }
    : null;
import { performOngDeletion } from "../services/delete-ong";
import { authorizeOngDeletion } from "../utils/delete-access";
import { deleteUploadedFile } from "../../../utils/media";

export default factories.createCoreController("api::ong.ong", ({ strapi }) => ({
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    // Anonymized organizations stay listed (BR-33): FDSC must still see that
    // their evaluations were completed, and this list is the only navigation to
    // them. `ngoStatus` rides along so the frontend can badge them "Retras".
    // `listActive` below keeps its own `ngoStatus: "active"` filter — a deleted
    // organization must never reach an "available to assign" picker.
    const ongs = await strapi.documents("api::ong.ong").findMany({
      sort: { name: "asc" },
      populate: {
        judet: true,
        localitate: true,
        programs: true,
        domeniuPrincipal: true,
      },
    });
    const byOng = await membersByOng(strapi);
    return {
      data: ongs.map((ong) => {
        const { admin, memberCount } = byOng.get(ong.documentId) ?? {
          admin: null,
          memberCount: 0,
        };
        return {
          documentId: ong.documentId,
          name: ong.name,
          cui: ong.cui,
          ngoStatus: ong.ngoStatus,
          website: ong.website,
          adresa: ong.adresa,
          dataInfiintare: ong.dataInfiintare,
          domeniuActivitate: ong.domeniuPrincipal?.name ?? null,
          descriere: ong.descriere ?? null,
          memberCount,
          admin: admin ? { nume: admin.nume } : null,
          programs: ((ong.programs ?? []) as any[]).map((program) => ({
            documentId: program.documentId,
            name: program.name,
          })),
          judet: ong.judet
            ? { documentId: ong.judet.documentId, nume: ong.judet.nume }
            : null,
          localitate: ong.localitate
            ? {
                documentId: ong.localitate.documentId,
                nume: ong.localitate.nume,
              }
            : null,
        };
      }),
    };
  },
  async detail(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
      populate: {
        judet: true,
        localitate: true,
        programs: true,
        domeniuPrincipal: true,
        domeniuSecundar: true,
      },
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    if (ctx.state.user.role?.type === "ngo-admin") {
      const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      if (!belongsToOng(user, ong.documentId)) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }
    if (ctx.state.user.role?.type === "mentor") {
      const hasOng = await mentorHasOng(
        strapi,
        ctx.state.user.documentId,
        ong.documentId,
      );
      if (!hasOng) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }
    const members = await strapi
      .documents("plugin::users-permissions.user")
      .findMany({
        filters: {
          role: { type: { $in: ["ngo-admin", "ngo-member"] } },
          ong: { documentId: ong.documentId },
        },
        populate: { role: true },
      });
    const admin = (members as any[]).find(
      (member) => member.role?.type === "ngo-admin",
    );
    const memberCount = (members as any[]).filter(
      (member) => member.role?.type === "ngo-member",
    ).length;
    let lastLogin: string | null = null;
    if (admin) {
      const latestToken = await strapi.db
        .query("api::refresh-token.refresh-token")
        .findOne({
          where: { user: admin.id },
          orderBy: { createdAt: "desc" },
          select: ["createdAt"],
        });
      lastLogin = latestToken?.createdAt ?? null;
    }
    return {
      data: {
        documentId: ong.documentId,
        name: ong.name,
        cui: ong.cui,
        website: ong.website,
        adresa: ong.adresa,
        dataInfiintare: ong.dataInfiintare,
        domeniuActivitate: ong.domeniuPrincipal?.name ?? null,
        domeniuSecundar: ong.domeniuSecundar?.name ?? null,
        socialMedia: ong.socialMedia ?? null,
        descriere: ong.descriere ?? null,
        memberCount,
        admin: admin
          ? {
              nume: admin.nume,
              email: admin.email,
              telefon: admin.telefon ?? null,
              createdAt: admin.createdAt,
              lastLogin,
            }
          : null,
        programs: ((ong.programs ?? []) as any[]).map((program) => ({
          documentId: program.documentId,
          name: program.name,
        })),
        judet: ong.judet
          ? { documentId: ong.judet.documentId, nume: ong.judet.nume }
          : null,
        localitate: ong.localitate
          ? {
              documentId: ong.localitate.documentId,
              nume: ong.localitate.nume,
            }
          : null,
      },
    };
  },
  /**
   * `Șterge ONG` for a super-admin (any organization) and for an ngo-admin
   * (only one they belong to).
   *
   * The route policy establishes the caller's *role*; it says nothing about
   * *which* organization is theirs. Ownership is therefore decided here, by
   * `authorizeOngDeletion`, against memberships loaded from the database. The
   * only identifier that reaches it is `ctx.params.documentId` — the request
   * body, query string and headers are never consulted, and the role comes from
   * `ctx.state.user`, set by the authentication layer.
   *
   * An ngo-admin who does not own the target gets exactly the response they
   * would get for an organization that does not exist, so the endpoint cannot
   * be used to enumerate organization ids.
   */
  async deleteOne(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const targetDocumentId = ctx.params.documentId;
    const decision = await authorizeOngDeletion(strapi, {
      actorDocumentId: ctx.state.user.documentId,
      roleType: ctx.state.user.role?.type,
      targetDocumentId,
    });
    if (decision.outcome === "denied") {
      return decision.status === "forbidden"
        ? ctx.forbidden(decision.message)
        : ctx.badRequest(decision.message);
    }
    await performOngDeletion(strapi, targetDocumentId);
    return { data: { documentId: targetDocumentId } };
  },
  async listActive(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ongs = await strapi.documents("api::ong.ong").findMany({
      filters: { ngoStatus: "active" },
      sort: { name: "asc" },
    });
    return {
      data: ongs.map((ong) => ({
        documentId: ong.documentId,
        name: ong.name,
      })),
    };
  },
  async members(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const members = await strapi
      .documents("plugin::users-permissions.user")
      .findMany({
        filters: {
          ong: { documentId: scope.ong.documentId },
          role: { type: "ngo-member" },
        },
        sort: { nume: "asc" },
      });
    const activationTokens = exposeActivationLink()
      ? await pendingActivationTokens(
          strapi,
          members.map((member) => member.documentId),
        )
      : new Map<string, string>();
    const roles = await getNgoMemberRoles(
      strapi,
      scope.ong.documentId,
      members.map((member) => member.documentId),
    );
    return {
      data: members.map((member) => {
        const activationToken = activationTokens.get(member.documentId);
        return {
          id: member.id,
          documentId: member.documentId,
          nume: member.nume,
          email: member.email,
          rol: roles.get(member.documentId) ?? null,
          accountStatus: member.accountStatus,
          createdAt: member.createdAt,
          ...(activationToken
            ? {
                activationLink: buildActivationLink(
                  activationToken,
                  ACTIVATION_PATH,
                ),
              }
            : {}),
        };
      }),
    };
  },
  async removeMember(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const member = await strapi
      .documents("plugin::users-permissions.user")
      .findOne({
        documentId: ctx.params.documentId,
        populate: { role: true },
      });
    if (!member || member.role?.type !== "ngo-member") {
      return ctx.badRequest("Membrul nu a fost găsit");
    }
    const result = await removeOngMembership(
      strapi,
      member.documentId,
      scope.ong.documentId,
    );
    if ("error" in result) {
      return ctx.badRequest(result.error);
    }
    return { data: result.data };
  },
  async joinable(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
    const memberOngIds = new Set(
      ((user?.ong ?? []) as any[])
        .map((ong) => ong?.documentId)
        .filter(Boolean),
    );
    const pendingRequests = await strapi
      .documents("api::ong-join-request.ong-join-request")
      .findMany({
        filters: {
          user: { documentId: user.documentId },
          status: "pending",
        },
        populate: { ong: true },
      });
    const pendingOngIds = new Set(
      (pendingRequests as any[])
        .map((request) => request.ong?.documentId)
        .filter(Boolean),
    );
    const qParam = ctx.query.q;
    const q = typeof qParam === "string" ? qParam.trim() : "";
    const ongs = await strapi.documents("api::ong.ong").findMany({
      filters: {
        ngoStatus: "active",
        ...(q
          ? {
              $or: [
                { name: { $containsi: q } },
                { cui: { $containsi: q } },
              ],
            }
          : {}),
      },
      sort: { name: "asc" },
      populate: { localitate: true, domeniuPrincipal: true },
    });
    const byOng = await membersByOng(strapi);
    return {
      data: (ongs as any[])
        .filter((ong) => !memberOngIds.has(ong.documentId))
        .map((ong) => ({
          documentId: ong.documentId,
          name: ong.name,
          cui: ong.cui ?? null,
          domeniu: ong.domeniuPrincipal?.name ?? null,
          localitate: ong.localitate?.nume ?? null,
          memberCount: byOng.get(ong.documentId)?.memberCount ?? 0,
          hasPendingRequest: pendingOngIds.has(ong.documentId),
        })),
    };
  },
  async createJoinRequest(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong || ong.ngoStatus !== "active") {
      return ctx.badRequest("Organizația nu există");
    }
    const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
    if (belongsToOng(user, ong.documentId)) {
      return ctx.badRequest("Faci deja parte din această organizație");
    }
    const existing = await strapi
      .documents("api::ong-join-request.ong-join-request")
      .findMany({
        filters: {
          user: { documentId: user.documentId },
          ong: { documentId: ong.documentId },
          status: "pending",
        },
      });
    if (existing.length > 0) {
      return ctx.badRequest(
        "Ai deja o cerere în așteptare pentru această organizație",
      );
    }
    const messageRaw = (ctx.request.body as any)?.message;
    const message =
      typeof messageRaw === "string" && messageRaw.trim()
        ? messageRaw.trim().slice(0, 1000)
        : undefined;
    const created = await strapi
      .documents("api::ong-join-request.ong-join-request")
      .create({
        data: {
          user: user.documentId,
          ong: ong.documentId,
          status: "pending",
          ...(message ? { message } : {}),
        },
      });
    return { data: { documentId: created.documentId } };
  },
  async joinRequests(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const requests = await strapi
      .documents("api::ong-join-request.ong-join-request")
      .findMany({
        filters: {
          ong: { documentId: scope.ong.documentId },
          status: "pending",
        },
        sort: { createdAt: "asc" },
        populate: { user: true },
      });
    return {
      data: (requests as any[])
        .filter((request) => request.user)
        .map((request) => ({
          documentId: request.documentId,
          message: request.message ?? null,
          createdAt: request.createdAt,
          user: {
            documentId: request.user.documentId,
            nume: request.user.nume,
            email: request.user.email,
          },
        })),
    };
  },
  async acceptJoinRequest(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const parsed = acceptJoinRequestSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const request = await strapi
      .documents("api::ong-join-request.ong-join-request")
      .findOne({
        documentId: ctx.params.documentId,
        populate: { ong: true, user: true },
      });
    if (
      !request ||
      request.ong?.documentId !== scope.ong.documentId ||
      request.status !== "pending"
    ) {
      return ctx.badRequest("Cererea nu a fost găsită");
    }
    await addOngMembership(
      strapi,
      request.user.documentId,
      scope.ong.documentId,
      parsed.data.rol,
    );
    await strapi.documents("api::ong-join-request.ong-join-request").update({
      documentId: request.documentId,
      data: { status: "accepted" },
    });
    return { data: { documentId: request.documentId } };
  },
  async rejectJoinRequest(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const request = await strapi
      .documents("api::ong-join-request.ong-join-request")
      .findOne({
        documentId: ctx.params.documentId,
        populate: { ong: true },
      });
    if (
      !request ||
      request.ong?.documentId !== scope.ong.documentId ||
      request.status !== "pending"
    ) {
      return ctx.badRequest("Cererea nu a fost găsită");
    }
    await strapi.documents("api::ong-join-request.ong-join-request").update({
      documentId: request.documentId,
      data: { status: "rejected" },
    });
    return { data: { documentId: request.documentId } };
  },
  async me(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: scope.ong.documentId,
      populate: {
        judet: true,
        localitate: true,
        logo: true,
        domeniuPrincipal: true,
        domeniuSecundar: true,
      },
    });
    const user = scope.user as any;
    return { data: serializeMyOng(ong, user) };
  },
  async updateMe(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const parsed = await updateMyOngSchema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const { logo, domeniuPrincipal, domeniuSecundar, ...rest } = parsed.data;
    const updated = await strapi.documents("api::ong.ong").update({
      documentId: scope.ong.documentId,
      data: {
        ...rest,
        ...(domeniuPrincipal !== undefined
          ? { domeniuPrincipal: { documentId: domeniuPrincipal } }
          : {}),
        ...(domeniuSecundar !== undefined
          ? { domeniuSecundar: { documentId: domeniuSecundar } }
          : {}),
        ...(logo !== undefined
          ? { logo: logo === null ? null : { id: logo } }
          : {}),
      },
      populate: {
        judet: true,
        localitate: true,
        logo: true,
        domeniuPrincipal: true,
        domeniuSecundar: true,
      },
    });
    const user = scope.user as any;
    return { data: serializeMyOng(updated, user) };
  },
  async overview(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    if (ctx.state.user.role?.type === "mentor") {
      const hasOng = await mentorHasOng(
        strapi,
        ctx.state.user.documentId,
        ong.documentId,
      );
      if (!hasOng) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }
    const reports = await strapi.documents("api::report.report").findMany({
      filters: { ong: { documentId: ong.documentId } },
      sort: { createdAt: "desc" },
      populate: {
        phases: { populate: { program: true } },
        evaluations: { populate: { dimensions: { populate: { quiz: true } } } },
      },
    });
    const today = todayInBucharest();
    const current = (reports as any[]).find(
      (report) => !isClosed(report, today),
    );
    const currentPhases = (current?.phases ?? []) as any[];
    const currentProgram =
      currentPhases.find((phase) => phase.program)?.program ?? null;
    const closedDate = (report: any) =>
      report.finishedAt ??
      ((report.phases ?? []) as any[])
        .map((phase) => phase.endDate)
        .filter(Boolean)
        .sort()
        .pop() ??
      null;
    const lastFinalizedDate =
      (reports as any[])
        .filter((report) => isClosed(report, today))
        .map(closedDate)
        .filter(Boolean)
        .sort()
        .pop() ?? null;
    return {
      data: {
        totalEvaluations: reports.length,
        currentEvaluation: current
          ? {
              documentId: current.documentId,
              invitedCount: (current.evaluations ?? []).length,
              completedCount: (current.evaluations ?? []).filter(
                (evaluation: any) =>
                  computeProgress(
                    evaluation.dimensions,
                    isClosed(current, today),
                  ).complete,
              ).length,
              program: currentProgram
                ? {
                    documentId: currentProgram.documentId,
                    name: currentProgram.name,
                  }
                : null,
            }
          : null,
        lastFinalizedDate,
      },
    };
  },
  async evaluations(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    if (ctx.state.user.role?.type === "mentor") {
      const hasOng = await mentorHasOng(
        strapi,
        ctx.state.user.documentId,
        ong.documentId,
      );
      if (!hasOng) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }
    const programParam = ctx.query.program;
    if (programParam !== undefined && typeof programParam !== "string") {
      return ctx.badRequest("Parametrul program este invalid");
    }
    const programDocumentId = programParam as string | undefined;
    if (programDocumentId) {
      const program = await strapi.documents("api::program.program").findOne({
        documentId: programDocumentId,
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
    }
    const reports = await strapi.documents("api::report.report").findMany({
      filters: { ong: { documentId: ong.documentId } },
      sort: { createdAt: "desc" },
      populate: {
        phases: { populate: { program: true } },
        evaluations: { populate: { dimensions: { populate: { quiz: true } } } },
      },
    });
    const eligible = programDocumentId
      ? reports.filter(
          (report: any) => phaseOfSameProgram(report, programDocumentId),
        )
      : reports;
    const today = todayInBucharest();
    return {
      data: eligible.map((report: any) => ({
        documentId: report.documentId,
        name: report.name,
        createdAt: report.createdAt,
        finished: isClosed(report, today),
        finishedAt: report.finishedAt,
        invitedCount: (report.evaluations ?? []).length,
        completedCount: (report.evaluations ?? []).filter(
          (evaluation: any) =>
            computeProgress(evaluation.dimensions, isClosed(report, today))
              .complete,
        ).length,
        scores: computeReportScores(report.evaluations ?? []),
        phases: ((report.phases ?? []) as any[]).map((phase) => ({
          documentId: phase.documentId,
          title: phase.title,
          startDate: phase.startDate,
          endDate: phase.endDate,
          program: phase.program
            ? { documentId: phase.program.documentId, name: phase.program.name }
            : null,
        })),
      })),
    };
  },
  async fdscReports(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    if (ctx.state.user.role?.type === "mentor") {
      const hasOng = await mentorHasOng(
        strapi,
        ctx.state.user.documentId,
        ong.documentId,
      );
      if (!hasOng) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }
    const reports = await strapi
      .documents("api::fdsc-report.fdsc-report")
      .findMany({
        filters: { ong: { documentId: ong.documentId } },
        sort: { uploadedAt: "desc" },
        populate: {
          evaluation: { populate: { phases: { populate: { program: true } } } },
          file: true,
        },
      });
    return {
      data: (reports as any[]).map((report) => ({
        documentId: report.documentId,
        name: report.name,
        uploadedAt: report.uploadedAt,
        evaluation: report.evaluation
          ? {
              documentId: report.evaluation.documentId,
              name: report.evaluation.name,
              program: programOfReport(report.evaluation),
            }
          : null,
        file: report.file
          ? {
              url: report.file.url,
              name: report.file.name,
              ext: report.file.ext,
            }
          : null,
      })),
    };
  },
  async createFdscReport(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    const parsed = createFdscReportSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const evaluation = await strapi.documents("api::report.report").findOne({
      documentId: parsed.data.evaluation,
      populate: { ong: true, phases: { populate: { program: true } } },
    });
    if (!evaluation) {
      return ctx.badRequest("Evaluarea nu există");
    }
    if ((evaluation.ong as any)?.documentId !== ong.documentId) {
      return ctx.badRequest("Evaluarea nu aparține acestei organizații");
    }
    const uploaded = await uploadSingleFile(ctx);
    if ("error" in uploaded) {
      return ctx.badRequest(uploaded.error);
    }
    const created = await strapi
      .documents("api::fdsc-report.fdsc-report")
      .create({
        data: {
          name: parsed.data.name,
          ong: docRef(ong.documentId),
          evaluation: docRef(evaluation.documentId),
          file: { id: uploaded.id },
          uploadedAt: new Date().toISOString(),
        },
        populate: {
          evaluation: { populate: { phases: { populate: { program: true } } } },
          file: true,
        },
      });
    return {
      data: {
        documentId: created.documentId,
        name: created.name,
        uploadedAt: created.uploadedAt,
        evaluation: created.evaluation
          ? {
              documentId: created.evaluation.documentId,
              name: created.evaluation.name,
              program: programOfReport(created.evaluation),
            }
          : null,
        file: created.file
          ? {
              url: created.file.url,
              name: created.file.name,
              ext: created.file.ext,
            }
          : null,
      },
    };
  },
  async deleteFdscReport(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    const report = await strapi
      .documents("api::fdsc-report.fdsc-report")
      .findOne({
        documentId: ctx.params.reportDocumentId,
        populate: { ong: true, file: true },
      });
    if (!report || (report.ong as any)?.documentId !== ong.documentId) {
      return ctx.badRequest("Raportul nu există");
    }
    await deleteUploadedFile(strapi, report.file as any);
    await strapi
      .documents("api::fdsc-report.fdsc-report")
      .delete({ documentId: report.documentId });
    return { message: "Raportul a fost șters cu succes" };
  },
  async mentors(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    if (ctx.state.user.role?.type === "ngo-admin") {
      const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      if (!belongsToOng(user, ong.documentId)) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }

    const rows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
      filters: { ong: { documentId: ong.documentId } },
      populate: { program: true, mentors: { populate: { avatar: true } } },
    });
    const mentorsById = new Map<string, any>();
    for (const row of rows as any[]) {
      const rowPrograms = Array.isArray(row.program)
        ? row.program
        : row.program
          ? [row.program]
          : [];
      for (const mentor of (row.mentors ?? []) as any[]) {
        const existing = mentorsById.get(mentor.documentId);
        if (existing) {
          for (const program of rowPrograms) {
            if (
              !existing.programs.some(
                (p: any) => p.documentId === program.documentId,
              )
            ) {
              existing.programs.push({
                documentId: program.documentId,
                name: program.name,
              });
            }
          }
          continue;
        }
        const deleted = isAnonymized(mentor);
        mentorsById.set(mentor.documentId, {
          documentId: mentor.documentId,
          nume: mentor.nume,
          email: deleted ? null : mentor.email,
          mentorJobTitle: deleted ? null : (mentor.mentorJobTitle ?? null),
          mentorOrganization: deleted
            ? null
            : (mentor.mentorOrganization ?? null),
          ariiDeExpertiza: deleted ? [] : (mentor.ariiDeExpertiza ?? []),
          isDeleted: deleted,
          avatar:
            !deleted && mentor.avatar
              ? {
                  documentId: mentor.avatar.documentId,
                  name: mentor.avatar.name,
                  url: mentor.avatar.url,
                }
              : null,
          programs: rowPrograms.map((program: any) => ({
            documentId: program.documentId,
            name: program.name,
          })),
        });
      }
    }
    return { data: [...mentorsById.values()] };
  },
  async evaluationDetail(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    if (ctx.state.user.role?.type === "mentor") {
      const hasOng = await mentorHasOng(
        strapi,
        ctx.state.user.documentId,
        ctx.params.documentId,
      );
      if (!hasOng) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }
    const report = await strapi.documents("api::report.report").findOne({
      documentId: ctx.params.reportDocumentId,
      populate: {
        ong: true,
        phases: { populate: { program: true } },
        evaluations: {
          populate: { dimensions: { populate: { quiz: true } }, user: true },
        },
      },
    });
    if (!report || report.ong?.documentId !== ctx.params.documentId) {
      return ctx.badRequest("Evaluarea nu există");
    }
    const today = todayInBucharest();
    const responses = (report.evaluations ?? []) as any[];
    return {
      data: {
        documentId: report.documentId,
        name: report.name,
        createdAt: report.createdAt,
        finished: isClosed(report, today),
        finishedAt: report.finishedAt,
        closedBy: report.closedBy,
        ong: { documentId: report.ong.documentId, name: report.ong.name },
        phases: ((report.phases ?? []) as any[]).map((phase) => ({
          documentId: phase.documentId,
          title: phase.title,
          startDate: phase.startDate,
          endDate: phase.endDate,
          program: phase.program
            ? { documentId: phase.program.documentId, name: phase.program.name }
            : null,
        })),
        invitedCount: responses.length,
        completedCount: responses.filter(
          (evaluation) =>
            computeProgress(evaluation.dimensions, isClosed(report, today))
              .complete,
        ).length,
        scores: computeReportScores(responses),
        evaluations: responses.map((evaluation) => ({
          documentId: evaluation.documentId,
          user: evaluation.user
            ? {
                documentId: evaluation.user.documentId,
                nume: evaluation.user.nume,
                email: isAnonymized(evaluation.user)
                  ? null
                  : evaluation.user.email,
              }
            : null,
          progress: computeProgress(
            evaluation.dimensions,
            isClosed(report, today),
          ),
          completedAt: evaluation.completedAt ?? null,
          scores: computeEvaluationScores(evaluation),
          dimensions: (evaluation.dimensions ?? []).map(decorateBlock),
        })),
      },
    };
  },
  async meetings(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    if (ctx.state.user.role?.type === "ngo-admin") {
      const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      if (!belongsToOng(user, ong.documentId)) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
    }

    const { mentor, program, status, format } = ctx.query;
    const mentorId = typeof mentor === "string" ? mentor.trim() : "";
    const programId = typeof program === "string" ? program.trim() : "";
    const statusFilter = typeof status === "string" ? status.trim() : "";
    const formatFilter = typeof format === "string" ? format.trim() : "";

    const meetings = await strapi.documents("api::meeting.meeting").findMany({
      filters: {
        ong: { documentId: ong.documentId },
        ...(mentorId ? { mentor: { documentId: mentorId } } : {}),
        ...(programId ? { program: { documentId: programId } } : {}),
        ...(statusFilter ? { status: statusFilter as any } : {}),
        ...(formatFilter ? { format: formatFilter as any } : {}),
      },
      sort: { dataOra: "desc" },
      populate: {
        mentor: true,
        program: true,
        activityType: true,
        report: true,
      },
    });

    return {
      data: (meetings as any[]).map((meeting) => ({
        documentId: meeting.documentId,
        dataOra: meeting.dataOra,
        format: meeting.format,
        status: meeting.status,
        subiect: meeting.subiect,
        linkIntalnire: meeting.linkIntalnire ?? null,
        mentor: meetingMentorView(meeting.mentor),
        program: meeting.program
          ? {
              documentId: meeting.program.documentId,
              name: meeting.program.name,
            }
          : null,
        activityType: meeting.activityType
          ? {
              documentId: meeting.activityType.documentId,
              name: meeting.activityType.name,
            }
          : null,
        dimensiuni: Array.isArray(meeting.dimensiuni)
          ? meeting.dimensiuni.filter(
              (key: unknown): key is string =>
                typeof key === "string" && VALID_DIMENSION_KEYS.has(key),
            )
          : [],
        comentarii: meeting.comentarii ?? null,
        report: meeting.report
          ? {
              url: meeting.report.url,
              name: meeting.report.name,
              ext: meeting.report.ext,
            }
          : null,
      })),
    };
  },
  async createMeeting(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }

    const parsed = createMeetingSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const data = parsed.data;

    const mentorRows = await strapi
      .documents("api::ngo-mentor.ngo-mentor")
      .findMany({
        filters: {
          ong: { documentId: ong.documentId },
          mentors: { documentId: data.mentor },
        },
      });
    if (mentorRows.length === 0) {
      return ctx.badRequest(
        "Persoana resursă selectată nu aparține acestei organizații",
      );
    }

    if (await isDeletedMentor(strapi, data.mentor)) {
      return ctx.badRequest(
        "Persoana resursă selectată și-a șters contul",
      );
    }

    if (data.program) {
      const program = await strapi.documents("api::program.program").findOne({
        documentId: data.program,
        populate: { ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const participates = ((program.ongs ?? []) as any[]).some(
        (entry) => entry.documentId === ong.documentId,
      );
      if (!participates) {
        return ctx.badRequest("Organizația nu participă la acest program");
      }
    }

    if (data.activityType) {
      const activityType = await strapi
        .documents("api::activity-type.activity-type")
        .findOne({ documentId: data.activityType });
      if (!activityType) {
        return ctx.badRequest("Tipul activității nu există");
      }
    }

    const dimensiuni = Array.isArray(data.dimensiuni)
      ? data.dimensiuni.filter((key) => VALID_DIMENSION_KEYS.has(key))
      : [];

    const created = await strapi.documents("api::meeting.meeting").create({
      data: {
        subiect: data.subiect,
        dataOra: data.dataOra,
        format: data.format,
        status: "programata",
        linkIntalnire: data.linkIntalnire || null,
        comentarii: data.comentarii || null,
        dimensiuni,
        ong: docRef(ong.documentId),
        mentor: docRef(data.mentor),
        ...(data.program ? { program: docRef(data.program) } : {}),
        ...(data.activityType
          ? { activityType: docRef(data.activityType) }
          : {}),
      },
      populate: { mentor: true, program: true, activityType: true },
    });

    return {
      data: {
        documentId: created.documentId,
        dataOra: created.dataOra,
        format: created.format,
        status: created.status,
        subiect: created.subiect,
        linkIntalnire: created.linkIntalnire ?? null,
        comentarii: created.comentarii ?? null,
        mentor: meetingMentorView(created.mentor),
        program: created.program
          ? {
              documentId: created.program.documentId,
              name: created.program.name,
            }
          : null,
        activityType: created.activityType
          ? {
              documentId: created.activityType.documentId,
              name: created.activityType.name,
            }
          : null,
        dimensiuni: Array.isArray(created.dimensiuni)
          ? created.dimensiuni.filter(
              (key: unknown): key is string =>
                typeof key === "string" && VALID_DIMENSION_KEYS.has(key),
            )
          : [],
        report: null,
      },
    };
  },
  async updateMeeting(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ong = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }

    const meeting = await strapi.documents("api::meeting.meeting").findOne({
      documentId: ctx.params.meetingDocumentId,
      populate: { ong: true },
    });
    if (!meeting || meeting.ong?.documentId !== ong.documentId) {
      return ctx.badRequest("Întâlnirea nu există");
    }
    if (meeting.status !== "programata") {
      return ctx.badRequest("Doar întâlnirile programate pot fi editate");
    }

    const parsed = createMeetingSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const data = parsed.data;

    const mentorRows = await strapi
      .documents("api::ngo-mentor.ngo-mentor")
      .findMany({
        filters: {
          ong: { documentId: ong.documentId },
          mentors: { documentId: data.mentor },
        },
      });
    if (mentorRows.length === 0) {
      return ctx.badRequest(
        "Persoana resursă selectată nu aparține acestei organizații",
      );
    }

    if (await isDeletedMentor(strapi, data.mentor)) {
      return ctx.badRequest(
        "Persoana resursă selectată și-a șters contul",
      );
    }

    if (data.program) {
      const program = await strapi.documents("api::program.program").findOne({
        documentId: data.program,
        populate: { ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const participates = ((program.ongs ?? []) as any[]).some(
        (entry) => entry.documentId === ong.documentId,
      );
      if (!participates) {
        return ctx.badRequest("Organizația nu participă la acest program");
      }
    }

    if (data.activityType) {
      const activityType = await strapi
        .documents("api::activity-type.activity-type")
        .findOne({ documentId: data.activityType });
      if (!activityType) {
        return ctx.badRequest("Tipul activității nu există");
      }
    }

    const dimensiuni = Array.isArray(data.dimensiuni)
      ? data.dimensiuni.filter((key) => VALID_DIMENSION_KEYS.has(key))
      : [];

    if (!(await claimMeetingStatus(meeting.documentId, "programata"))) {
      return ctx.badRequest(
        "Întâlnirea a fost modificată între timp. Reîncarcă pagina și încearcă din nou.",
      );
    }

    const updated = await strapi.documents("api::meeting.meeting").update({
      documentId: meeting.documentId,
      data: {
        subiect: data.subiect,
        dataOra: data.dataOra,
        format: data.format,
        linkIntalnire: data.linkIntalnire || null,
        comentarii: data.comentarii || null,
        dimensiuni,
        mentor: docRef(data.mentor),
        program: data.program ? docRef(data.program) : null,
        activityType: data.activityType ? docRef(data.activityType) : null,
      },
      populate: { mentor: true, program: true, activityType: true },
    });

    return {
      data: {
        documentId: updated.documentId,
        dataOra: updated.dataOra,
        format: updated.format,
        status: updated.status,
        subiect: updated.subiect,
        linkIntalnire: updated.linkIntalnire ?? null,
        comentarii: updated.comentarii ?? null,
        mentor: meetingMentorView(updated.mentor),
        program: updated.program
          ? {
              documentId: updated.program.documentId,
              name: updated.program.name,
            }
          : null,
        activityType: updated.activityType
          ? {
              documentId: updated.activityType.documentId,
              name: updated.activityType.name,
            }
          : null,
        dimensiuni: Array.isArray(updated.dimensiuni)
          ? updated.dimensiuni.filter(
              (key: unknown): key is string =>
                typeof key === "string" && VALID_DIMENSION_KEYS.has(key),
            )
          : [],
        report: null,
      },
    };
  },

  async ongsForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const rows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
      filters: { mentors: { documentId: ctx.state.user.documentId } },
      populate: { ong: true, program: true },
    });
    const ongsById = new Map<
      string,
      {
        documentId: string;
        name: string;
        programs: { documentId: string; name: string }[];
      }
    >();
    for (const row of rows as any[]) {
      const rowOngs = Array.isArray(row.ong)
        ? row.ong
        : row.ong
          ? [row.ong]
          : [];
      const rowPrograms = Array.isArray(row.program)
        ? row.program
        : row.program
          ? [row.program]
          : [];
      for (const ong of rowOngs) {
        const existing = ongsById.get(ong.documentId) ?? {
          documentId: ong.documentId,
          name: ong.name,
          programs: [] as { documentId: string; name: string }[],
        };
        for (const program of rowPrograms) {
          if (
            !existing.programs.some((p) => p.documentId === program.documentId)
          ) {
            existing.programs.push({
              documentId: program.documentId,
              name: program.name,
            });
          }
        }
        ongsById.set(ong.documentId, existing);
      }
    }
    return {
      data: Array.from(ongsById.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  },

  /**
   * The mentor's own programs (grouped from their `ngo-mentor` rows), each with
   * the ONGs they specifically mentor within it — as opposed to `ongsForMentor`,
   * which groups the same rows by ONG instead of by program.
   */
  async programsForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const rows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
      filters: { mentors: { documentId: ctx.state.user.documentId } },
      populate: { ong: true, program: true },
    });
    const byOng = await membersByOng(strapi);
    const today = todayInBucharest();
    const programsById = new Map<
      string,
      {
        documentId: string;
        name: string;
        startDate: string;
        endDate: string;
        programStatus: string;
        ongs: {
          documentId: string;
          name: string;
          memberCount: number;
          admin: { nume: string; email: string } | null;
        }[];
      }
    >();
    for (const row of rows as any[]) {
      const rowOngs = Array.isArray(row.ong) ? row.ong : row.ong ? [row.ong] : [];
      const rowPrograms = Array.isArray(row.program)
        ? row.program
        : row.program
          ? [row.program]
          : [];
      for (const program of rowPrograms) {
        const existing = programsById.get(program.documentId) ?? {
          documentId: program.documentId,
          name: program.name,
          startDate: program.startDate,
          endDate: program.endDate,
          programStatus: computeProgramStatus(
            toDateString(program.startDate),
            toDateString(program.endDate),
            today,
          ),
          ongs: [] as {
            documentId: string;
            name: string;
            memberCount: number;
            admin: { nume: string; email: string } | null;
          }[],
        };
        for (const ong of rowOngs) {
          if (existing.ongs.some((entry) => entry.documentId === ong.documentId)) {
            continue;
          }
          const members = byOng.get(ong.documentId);
          existing.ongs.push({
            documentId: ong.documentId,
            name: ong.name,
            memberCount: members?.memberCount ?? 0,
            admin: members?.admin
              ? { nume: members.admin.nume, email: members.admin.email }
              : null,
          });
        }
        programsById.set(program.documentId, existing);
      }
    }
    const statusPriority: Record<string, number> = {
      Active: 0,
      Upcoming: 1,
      Finished: 2,
    };
    return {
      data: Array.from(programsById.values())
        .map((program) => ({
          ...program,
          ongs: program.ongs.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => {
          const priorityDiff =
            (statusPriority[a.programStatus] ?? 3) -
            (statusPriority[b.programStatus] ?? 3);
          if (priorityDiff !== 0) {
            return priorityDiff;
          }
          return `${b.startDate}`.localeCompare(`${a.startDate}`);
        }),
    };
  },

  async meetingsForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const { ong, program, status, format } = ctx.query;
    const ongId = typeof ong === "string" ? ong.trim() : "";
    const programId = typeof program === "string" ? program.trim() : "";
    const statusFilter = typeof status === "string" ? status.trim() : "";
    const formatFilter = typeof format === "string" ? format.trim() : "";

    const meetings = await strapi.documents("api::meeting.meeting").findMany({
      filters: {
        mentor: { documentId: ctx.state.user.documentId },
        ...(ongId ? { ong: { documentId: ongId } } : {}),
        ...(programId ? { program: { documentId: programId } } : {}),
        ...(statusFilter ? { status: statusFilter as any } : {}),
        ...(formatFilter ? { format: formatFilter as any } : {}),
      },
      sort: { dataOra: "desc" },
      populate: {
        ong: true,
        mentor: true,
        program: true,
        activityType: true,
        report: true,
      },
    });

    return { data: (meetings as any[]).map(mentorMeetingView) };
  },

  async createMeetingForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const parsed = createMentorMeetingSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const data = parsed.data;

    const ong = await strapi
      .documents("api::ong.ong")
      .findOne({ documentId: data.ong });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    const assignmentRows = await strapi
      .documents("api::ngo-mentor.ngo-mentor")
      .findMany({
        filters: {
          ong: { documentId: ong.documentId },
          mentors: { documentId: ctx.state.user.documentId },
        },
      });
    if (assignmentRows.length === 0) {
      return ctx.badRequest("Nu ești alocat acestei organizații");
    }

    if (data.program) {
      const program = await strapi.documents("api::program.program").findOne({
        documentId: data.program,
        populate: { ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const participates = ((program.ongs ?? []) as any[]).some(
        (entry) => entry.documentId === ong.documentId,
      );
      if (!participates) {
        return ctx.badRequest("Organizația nu participă la acest program");
      }
    }

    if (data.activityType) {
      const activityType = await strapi
        .documents("api::activity-type.activity-type")
        .findOne({ documentId: data.activityType });
      if (!activityType) {
        return ctx.badRequest("Tipul activității nu există");
      }
    }

    const dimensiuni = Array.isArray(data.dimensiuni)
      ? data.dimensiuni.filter((key) => VALID_DIMENSION_KEYS.has(key))
      : [];

    const created = await strapi.documents("api::meeting.meeting").create({
      data: {
        subiect: data.subiect,
        dataOra: data.dataOra,
        format: data.format,
        status: "programata",
        linkIntalnire: data.linkIntalnire || null,
        comentarii: data.comentarii || null,
        dimensiuni,
        ong: docRef(ong.documentId),
        mentor: docRef(ctx.state.user.documentId),
        ...(data.program ? { program: docRef(data.program) } : {}),
        ...(data.activityType
          ? { activityType: docRef(data.activityType) }
          : {}),
      },
      populate: { ong: true, mentor: true, program: true, activityType: true },
    });

    return { data: mentorMeetingView({ ...created, report: null }) };
  },

  async updateMeetingForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const meeting = await strapi.documents("api::meeting.meeting").findOne({
      documentId: ctx.params.meetingDocumentId,
      populate: { mentor: true, ong: true },
    });
    if (!meeting || meeting.mentor?.documentId !== ctx.state.user.documentId) {
      return ctx.badRequest("Întâlnirea nu există");
    }
    if (meeting.status !== "programata") {
      return ctx.badRequest("Doar întâlnirile programate pot fi editate");
    }

    const parsed = createMentorMeetingSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const data = parsed.data;

    if (data.ong !== meeting.ong?.documentId) {
      return ctx.badRequest("Organizația unei întâlniri nu poate fi schimbată");
    }

    if (data.program) {
      const program = await strapi.documents("api::program.program").findOne({
        documentId: data.program,
        populate: { ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const participates = ((program.ongs ?? []) as any[]).some(
        (entry) => entry.documentId === meeting.ong?.documentId,
      );
      if (!participates) {
        return ctx.badRequest("Organizația nu participă la acest program");
      }
    }

    if (data.activityType) {
      const activityType = await strapi
        .documents("api::activity-type.activity-type")
        .findOne({ documentId: data.activityType });
      if (!activityType) {
        return ctx.badRequest("Tipul activității nu există");
      }
    }

    const dimensiuni = Array.isArray(data.dimensiuni)
      ? data.dimensiuni.filter((key) => VALID_DIMENSION_KEYS.has(key))
      : [];

    if (!(await claimMeetingStatus(meeting.documentId, "programata"))) {
      return ctx.badRequest(
        "Întâlnirea a fost modificată între timp. Reîncarcă pagina și încearcă din nou.",
      );
    }

    const updated = await strapi.documents("api::meeting.meeting").update({
      documentId: meeting.documentId,
      data: {
        subiect: data.subiect,
        dataOra: data.dataOra,
        format: data.format,
        linkIntalnire: data.linkIntalnire || null,
        comentarii: data.comentarii || null,
        dimensiuni,
        program: data.program ? docRef(data.program) : null,
        activityType: data.activityType ? docRef(data.activityType) : null,
      },
      populate: {
        ong: true,
        mentor: true,
        program: true,
        activityType: true,
        report: true,
      },
    });

    return { data: mentorMeetingView(updated) };
  },

  async cancelMeetingForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const meeting = await strapi.documents("api::meeting.meeting").findOne({
      documentId: ctx.params.meetingDocumentId,
      populate: { mentor: true },
    });
    if (!meeting || meeting.mentor?.documentId !== ctx.state.user.documentId) {
      return ctx.badRequest("Întâlnirea nu există");
    }
    if (meeting.status !== "programata") {
      return ctx.badRequest("Doar întâlnirile programate pot fi anulate");
    }
    // A single query-engine call does the "still programată?" check and the
    // status write together, so a concurrent request can't slip in between
    // the check above and this write and leave the meeting in both states.
    const updated = await strapi.db.query("api::meeting.meeting").update({
      where: { documentId: meeting.documentId, status: "programata" },
      data: { status: "anulata" },
      populate: {
        ong: true,
        mentor: true,
        program: true,
        activityType: true,
        report: true,
      },
    });
    if (!updated) {
      return ctx.badRequest(
        "Întâlnirea a fost modificată între timp. Reîncarcă pagina și încearcă din nou.",
      );
    }
    return { data: mentorMeetingView(updated) };
  },

  async completeMeetingForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const meeting = await strapi.documents("api::meeting.meeting").findOne({
      documentId: ctx.params.meetingDocumentId,
      populate: { mentor: true },
    });
    if (!meeting || meeting.mentor?.documentId !== ctx.state.user.documentId) {
      return ctx.badRequest("Întâlnirea nu există");
    }
    if (meeting.status !== "programata") {
      return ctx.badRequest(
        "Doar întâlnirile programate pot fi marcate ca efectuate",
      );
    }
    const updated = await strapi.db.query("api::meeting.meeting").update({
      where: { documentId: meeting.documentId, status: "programata" },
      data: { status: "efectuata" },
      populate: {
        ong: true,
        mentor: true,
        program: true,
        activityType: true,
        report: true,
      },
    });
    if (!updated) {
      return ctx.badRequest(
        "Întâlnirea a fost modificată între timp. Reîncarcă pagina și încearcă din nou.",
      );
    }
    return { data: mentorMeetingView(updated) };
  },

  async uploadMeetingReportForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const meeting = await strapi.documents("api::meeting.meeting").findOne({
      documentId: ctx.params.meetingDocumentId,
      populate: { mentor: true },
    });
    if (!meeting || meeting.mentor?.documentId !== ctx.state.user.documentId) {
      return ctx.badRequest("Întâlnirea nu există");
    }
    if (meeting.status !== "efectuata") {
      return ctx.badRequest(
        "Raportul poate fi adăugat doar pentru întâlniri efectuate",
      );
    }
    const uploaded = await uploadSingleFile(ctx);
    if ("error" in uploaded) {
      return ctx.badRequest(uploaded.error);
    }
    if (!(await claimMeetingStatus(meeting.documentId, "efectuata"))) {
      return ctx.badRequest(
        "Întâlnirea a fost modificată între timp. Reîncarcă pagina și încearcă din nou.",
      );
    }
    const updated = await strapi.documents("api::meeting.meeting").update({
      documentId: meeting.documentId,
      data: { report: { id: uploaded.id } },
      populate: {
        ong: true,
        mentor: true,
        program: true,
        activityType: true,
        report: true,
      },
    });
    return { data: mentorMeetingView(updated) };
  },
}));

/**
 * Uploads the single file on this request through the Upload plugin's own
 * service — not the public `/api/upload` HTTP route — so nothing is created
 * until every other validation in the calling action has already passed.
 * That keeps a rejected request (bad ownership, wrong meeting status, wrong
 * program, ...) from leaving an orphaned file behind, which the old
 * upload-then-attach flow could do whenever the attach step failed.
 */
async function uploadSingleFile(
  ctx: Context,
): Promise<{ id: number } | { error: string }> {
  const files = (ctx.request as any).files?.files;
  if (!files) {
    return { error: "Fișierul este obligatoriu" };
  }
  if (Array.isArray(files)) {
    return { error: "Poți încărca un singur fișier" };
  }
  const uploaded = await strapi
    .plugin("upload")
    .service("upload")
    .upload({ data: {}, files });
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  return { id: file.id };
}

/**
 * Optimistic-concurrency guard for a meeting write that also touches
 * relations (so it can't go through the single query-engine call `cancel`/
 * `complete` use below). Re-asserts, in one query-engine call immediately
 * before the real write, that the meeting's status still matches what was
 * read earlier in the request — a no-op status write that only succeeds if
 * nothing else changed the status in between. Closes the gap between an
 * earlier `findOne` status check and the eventual `update`, where two
 * concurrent requests could otherwise both pass the check and both write.
 */
async function claimMeetingStatus(
  documentId: string,
  expectedStatus: string,
): Promise<boolean> {
  const claimed = await strapi.db.query("api::meeting.meeting").update({
    where: { documentId, status: expectedStatus },
    data: { status: expectedStatus },
  });
  return Boolean(claimed);
}

function mentorMeetingView(meeting: any) {
  return {
    documentId: meeting.documentId,
    dataOra: meeting.dataOra,
    format: meeting.format,
    status: meeting.status,
    subiect: meeting.subiect,
    linkIntalnire: meeting.linkIntalnire ?? null,
    ong: meeting.ong
      ? { documentId: meeting.ong.documentId, name: meeting.ong.name }
      : null,
    mentor: meeting.mentor
      ? { documentId: meeting.mentor.documentId, nume: meeting.mentor.nume }
      : null,
    program: meeting.program
      ? { documentId: meeting.program.documentId, name: meeting.program.name }
      : null,
    activityType: meeting.activityType
      ? {
          documentId: meeting.activityType.documentId,
          name: meeting.activityType.name,
        }
      : null,
    dimensiuni: Array.isArray(meeting.dimensiuni)
      ? meeting.dimensiuni.filter(
          (key: unknown): key is string =>
            typeof key === "string" && VALID_DIMENSION_KEYS.has(key),
        )
      : [],
    comentarii: meeting.comentarii ?? null,
    report: meeting.report
      ? {
          url: meeting.report.url,
          name: meeting.report.name,
          ext: meeting.report.ext,
        }
      : null,
  };
}

async function membersByOng(
  strapi: any,
): Promise<Map<string, { admin: any; memberCount: number }>> {
  const members = await strapi
    .documents("plugin::users-permissions.user")
    .findMany({
      filters: { role: { type: { $in: ["ngo-admin", "ngo-member"] } } },
      populate: { role: true, ong: true },
    });
  const byOng = new Map<string, { admin: any; memberCount: number }>();
  for (const member of members as any[]) {
    for (const ong of (member.ong ?? []) as any[]) {
      const ongDocumentId = ong?.documentId;
      if (!ongDocumentId) continue;
      const entry = byOng.get(ongDocumentId) ?? { admin: null, memberCount: 0 };
      if (member.role?.type === "ngo-admin") {
        entry.admin = member;
      }
      if (member.role?.type === "ngo-member") {
        entry.memberCount += 1;
      }
      byOng.set(ongDocumentId, entry);
    }
  }
  return byOng;
}

function serializeMyOng(ong: any, user: any) {
  return {
    documentId: ong.documentId,
    name: ong.name,
    cui: ong.cui,
    judet: ong.judet
      ? { documentId: ong.judet.documentId, nume: ong.judet.nume }
      : null,
    localitate: ong.localitate
      ? { documentId: ong.localitate.documentId, nume: ong.localitate.nume }
      : null,
    contact: {
      nume: user.nume,
      email: user.email,
      telefon: user.telefon,
    },
    website: ong.website ?? null,
    logo: ong.logo ? { url: ong.logo.url } : null,
    domeniuPrincipal: ong.domeniuPrincipal
      ? {
          documentId: ong.domeniuPrincipal.documentId,
          name: ong.domeniuPrincipal.name,
        }
      : null,
    domeniuSecundar: ong.domeniuSecundar
      ? {
          documentId: ong.domeniuSecundar.documentId,
          name: ong.domeniuSecundar.name,
        }
      : null,
    socialMedia: ong.socialMedia ?? null,
    descriere: ong.descriere ?? null,
    cuvinteCheie: ong.cuvinteCheie ?? null,
  };
}
