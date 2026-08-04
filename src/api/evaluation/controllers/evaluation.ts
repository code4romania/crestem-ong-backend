import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { evaluationDimensionsSchema } from "../validation/evaluation";
import { computeProgress } from "../utils/progress";

const evaluationView = (evaluation: any) => ({
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
  report: evaluation.report
    ? {
        documentId: evaluation.report.documentId,
        finished: evaluation.report.finished,
        program: evaluation.report.program
          ? {
              documentId: evaluation.report.program.documentId,
              name: evaluation.report.program.name,
            }
          : null,
        phase: evaluation.report.phase
          ? {
              documentId: evaluation.report.phase.documentId,
              title: evaluation.report.phase.title,
              startDate: evaluation.report.phase.startDate,
              endDate: evaluation.report.phase.endDate,
            }
          : null,
      }
    : null,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

export default factories.createCoreController(
  "api::evaluation.evaluation",
  ({ strapi }) => ({
    async current(ctx: Context) {
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
      const evaluations = await strapi
        .documents("api::evaluation.evaluation")
        .findMany({
          filters: {
            email: { $eqi: user.email },
            report: {
              ong: { documentId: user.ong.documentId },
              finished: false,
            },
          },
          sort: { createdAt: "desc" },
          populate: {
            dimensions: true,
            report: { populate: { program: true, phase: true } },
          },
        });
      return {
        data: evaluations.map((evaluation) => ({
          documentId: evaluation.documentId,
          email: evaluation.email,
          report: {
            documentId: evaluation.report?.documentId,
            program: evaluation.report?.program
              ? {
                  documentId: evaluation.report.program.documentId,
                  name: evaluation.report.program.name,
                }
              : null,
            phase: (evaluation.report as any)?.phase
              ? {
                  documentId: (evaluation.report as any).phase.documentId,
                  title: (evaluation.report as any).phase.title,
                  startDate: (evaluation.report as any).phase.startDate,
                  endDate: (evaluation.report as any).phase.endDate,
                }
              : null,
          },
          progress: computeProgress(evaluation.dimensions),
        })),
      };
    },
    async detail(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const evaluation = await strapi
        .documents("api::evaluation.evaluation")
        .findOne({
          documentId: ctx.params.documentId,
          populate: {
            dimensions: { populate: { quiz: true } },
            report: { populate: { program: true, phase: true } },
          },
        });
      if (!evaluation) {
        return ctx.badRequest("Evaluarea nu există");
      }
      if (
        evaluation.email?.toLowerCase() !== ctx.state.user.email?.toLowerCase()
      ) {
        return ctx.forbidden("Nu ai acces la această evaluare");
      }
      return { data: evaluationView(evaluation) };
    },
    async updateOne(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = evaluationDimensionsSchema.safeParse(
        (ctx.request.body as any)?.dimensions,
      );
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const existing = await strapi
        .documents("api::evaluation.evaluation")
        .findOne({
          documentId: ctx.params.documentId,
          populate: {
            dimensions: { populate: { quiz: true } },
            report: { populate: { program: true, phase: true } },
          },
        });
      if (!existing) {
        return ctx.badRequest("Evaluarea nu există");
      }
      if (
        existing.email?.toLowerCase() !== ctx.state.user.email?.toLowerCase()
      ) {
        return ctx.forbidden("Nu ai acces la această evaluare");
      }
      if (existing.report?.finished) {
        return ctx.badRequest("Runda de evaluare este închisă");
      }
      if (
        (existing.report as any)?.phase &&
        `${(existing.report as any).phase.endDate}` < todayIso()
      ) {
        return ctx.badRequest("Termenul fazei de evaluare a expirat");
      }
      const saved = (existing.dimensions ?? []).map((block: any) => ({
        dimensionKey: block.dimensionKey,
        comment: block.comment,
        quiz: (block.quiz ?? []).map((question: any) => ({
          answer: question.answer,
        })),
      }));
      const savedKeys = new Set(saved.map((block: any) => block.dimensionKey));
      const resubmitted = parsed.data.find((block) =>
        savedKeys.has(block.dimensionKey),
      );
      if (resubmitted) {
        return ctx.badRequest(
          `Dimensiunea ${resubmitted.dimensionKey} a fost deja trimisă`,
        );
      }
      const updated = await strapi
        .documents("api::evaluation.evaluation")
        .update({
          documentId: existing.documentId,
          data: { dimensions: [...saved, ...parsed.data] },
          populate: {
            dimensions: { populate: { quiz: true } },
            report: { populate: { program: true, phase: true } },
          },
        });
      return { data: evaluationView(updated) };
    },
  }),
);
