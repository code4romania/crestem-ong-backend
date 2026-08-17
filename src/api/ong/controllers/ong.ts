/**
 * ong controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { computeProgress } from "../../evaluation/utils/progress";
import { computeReportScores } from "../../report/utils/scores";
import { phaseOfSameProgram } from "../../report/utils/association";
import { isClosed } from "../../report/utils/lifecycle";
import { todayInBucharest } from "../../../utils/date";
import { belongsToOng, loadUserWithOngs, requireOng } from "../../../utils/ong-scope";
import { addOngMembership, removeOngMembership } from "../../../utils/membership";
import { updateMyOngSchema } from "../validation/ong";
import { decorateBlock } from "../../evaluation/utils/catalog";

export default factories.createCoreController("api::ong.ong", ({ strapi }) => ({
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ongs = await strapi.documents("api::ong.ong").findMany({
      filters: { ngoStatus: { $ne: "deleted" } },
      sort: { name: "asc" },
      populate: { judet: true, localitate: true, programs: true },
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
          website: ong.website,
          adresa: ong.adresa,
          dataInfiintare: ong.dataInfiintare,
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
      populate: { judet: true, localitate: true, programs: true },
    });
    if (!ong) {
      return ctx.badRequest("Organizația nu există");
    }
    const members = await strapi
      .documents("plugin::users-permissions.user")
      .findMany({
        filters: {
          role: { type: { $in: ["ngo-admin", "ngo-member"] } },
          ongMemberships: { ong: { documentId: ong.documentId } },
        },
        populate: { role: true },
      });
    const admin = (members as any[]).find(
      (member) => member.role?.type === "ngo-admin",
    );
    const memberCount = (members as any[]).filter(
      (member) => member.role?.type === "ngo-member",
    ).length;
    return {
      data: {
        documentId: ong.documentId,
        name: ong.name,
        cui: ong.cui,
        website: ong.website,
        adresa: ong.adresa,
        dataInfiintare: ong.dataInfiintare,
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
      },
    };
  },
  async deleteOne(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const existing = await strapi.documents("api::ong.ong").findOne({
      documentId: ctx.params.documentId,
    });
    if (!existing) {
      return ctx.badRequest("Organizația nu există");
    }
    await strapi.documents("api::ong.ong").update({
      documentId: ctx.params.documentId,
      data: { ngoStatus: "deleted" },
    });
    return { data: { documentId: ctx.params.documentId } };
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
          ongMemberships: { ong: { documentId: scope.ong.documentId } },
          role: { type: "ngo-member" },
        },
        sort: { nume: "asc" },
        populate: { ongMemberships: { populate: { ong: true } } },
      });
    return {
      data: members.map((member) => {
        const membership = ((member.ongMemberships ?? []) as any[]).find(
          (entry) => entry.ong?.documentId === scope.ong.documentId,
        );
        return {
          documentId: member.documentId,
          nume: member.nume,
          email: member.email,
          accountStatus: member.accountStatus,
          rolMembruOng: membership?.rolMembruOng ?? null,
          createdAt: member.createdAt,
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
      ((user?.ongMemberships ?? []) as any[])
        .map((membership) => membership.ong?.documentId)
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
                { localitate: { nume: { $containsi: q } } },
                { domeniuPrincipal: { name: { $containsi: q } } },
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
          domeniu: ong.domeniuPrincipal?.name ?? null,
          localitate: ong.localitate?.nume ?? null,
          memberCount: byOng.get(ong.documentId)?.memberCount ?? 0,
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
        filters: { ong: { documentId: scope.ong.documentId }, status: "pending" },
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
      "Membru",
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
        ...(logo !== undefined ? { logo: logo === null ? null : { id: logo } } : {}),
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
          (report: any) => !phaseOfSameProgram(report, programDocumentId),
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
  async evaluationDetail(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
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
                email: evaluation.user.email,
              }
            : null,
          progress: computeProgress(
            evaluation.dimensions,
            isClosed(report, today),
          ),
          dimensions: (evaluation.dimensions ?? []).map(decorateBlock),
        })),
      },
    };
  },
}));

async function membersByOng(
  strapi: any,
): Promise<Map<string, { admin: any; memberCount: number }>> {
  const members = await strapi
    .documents("plugin::users-permissions.user")
    .findMany({
      filters: { role: { type: { $in: ["ngo-admin", "ngo-member"] } } },
      populate: { role: true, ongMemberships: { populate: { ong: true } } },
    });
  const byOng = new Map<string, { admin: any; memberCount: number }>();
  for (const member of members as any[]) {
    for (const membership of (member.ongMemberships ?? []) as any[]) {
      const ongDocumentId = membership.ong?.documentId;
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
    judet: ong.judet ? { documentId: ong.judet.documentId, nume: ong.judet.nume } : null,
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
      ? { documentId: ong.domeniuPrincipal.documentId, name: ong.domeniuPrincipal.name }
      : null,
    domeniuSecundar: ong.domeniuSecundar
      ? { documentId: ong.domeniuSecundar.documentId, name: ong.domeniuSecundar.name }
      : null,
    socialMedia: ong.socialMedia ?? null,
    descriere: ong.descriere ?? null,
    cuvinteCheie: ong.cuvinteCheie ?? null,
  };
}
