/**
 * ong controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { computeProgress } from "../../evaluation/utils/progress";
import { computeReportScores } from "../../report/utils/scores";

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
    const user = await strapi
      .documents("plugin::users-permissions.user")
      .findOne({
        documentId: ctx.state.user.documentId,
        populate: { ong: true },
      });
    if (!user?.ong) {
      return { data: [] };
    }
    const members = await strapi
      .documents("plugin::users-permissions.user")
      .findMany({
        filters: {
          ong: { documentId: user.ong.documentId },
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
    const reports = await strapi.documents("api::report.report").findMany({
      filters: { ong: { documentId: ong.documentId } },
      sort: { createdAt: "desc" },
      populate: {
        phases: { populate: { program: true } },
        evaluations: { populate: { dimensions: true } },
      },
    });
    return {
      data: reports.map((report: any) => ({
        documentId: report.documentId,
        createdAt: report.createdAt,
        finished: report.finished,
        finishedAt: report.finishedAt,
        respondents: (report.evaluations ?? []).length,
        completedRespondents: (report.evaluations ?? []).filter(
          (evaluation: any) =>
            computeProgress(evaluation.dimensions).complete,
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
        evaluations: { populate: { dimensions: { populate: { quiz: true } } } },
      },
    });
    if (!report || report.ong?.documentId !== ctx.params.documentId) {
      return ctx.badRequest("Evaluarea nu există");
    }
    const responses = (report.evaluations ?? []) as any[];
    return {
      data: {
        documentId: report.documentId,
        createdAt: report.createdAt,
        finished: report.finished,
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
        respondents: responses.length,
        completedRespondents: responses.filter(
          (evaluation) => computeProgress(evaluation.dimensions).complete,
        ).length,
        scores: computeReportScores(responses),
        evaluations: responses.map((evaluation) => ({
          documentId: evaluation.documentId,
          email: evaluation.email,
          progress: computeProgress(evaluation.dimensions),
          dimensions: (evaluation.dimensions ?? []).map((block: any) => ({
            dimensionKey: block.dimensionKey,
            comment: block.comment,
            quiz: (block.quiz ?? []).map((question: any) => ({
              answer: question.answer,
            })),
          })),
        })),
      },
    };
  },
}));
