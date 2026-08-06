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
import { requireOng } from "../../../utils/ong-scope";
import { decorateBlock } from "../../evaluation/utils/catalog";

export default factories.createCoreController("api::ong.ong", ({ strapi }) => ({
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ongs = await strapi.documents("api::ong.ong").findMany({
      sort: { name: "asc" },
      populate: { judet: true, localitate: true },
    });
    return {
      data: ongs.map((ong) => ({
        documentId: ong.documentId,
        name: ong.name,
        cui: ong.cui,
        website: ong.website,
        adresa: ong.adresa,
        dataInfiintare: ong.dataInfiintare,
        domeniuActivitate: ong.domeniuActivitate,
        judet: ong.judet
          ? { documentId: ong.judet.documentId, nume: ong.judet.nume }
          : null,
        localitate: ong.localitate
          ? {
              documentId: ong.localitate.documentId,
              nume: ong.localitate.nume,
            }
          : null,
      })),
    };
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
          ongs: { documentId: scope.ong.documentId },
          role: { type: "ngo-member" },
        },
        sort: { nume: "asc" },
      });
    return {
      data: members.map((member) => ({
        documentId: member.documentId,
        nume: member.nume,
        email: member.email,
        accountStatus: member.accountStatus,
      })),
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
        evaluations: { populate: { dimensions: true } },
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
        phases: ((report.phases ?? []) as any[]).map((phase) => ({
          documentId: phase.documentId,
          title: phase.title,
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
