import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { evaluationDimensionsSchema } from "../validation/evaluation";
import { computeProgress } from "../utils/progress";
import { toDateString, todayInBucharest } from "../../../utils/date";

const reportPhaseView = (phase: any) => ({
  documentId: phase.documentId,
  title: phase.title,
  startDate: phase.startDate,
  endDate: phase.endDate,
  program: phase.program
    ? { documentId: phase.program.documentId, name: phase.program.name }
    : null,
});

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
        phases: (evaluation.report.phases ?? []).map(reportPhaseView),
      }
    : null,
});

const todayIso = () => todayInBucharest();

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
            report: { populate: { phases: { populate: { program: true } } } },
          },
        });
      return {
        data: evaluations.map((evaluation) => ({
          documentId: evaluation.documentId,
          email: evaluation.email,
          report: {
            documentId: evaluation.report?.documentId,
            phases: ((evaluation.report?.phases ?? []) as any[]).map(
              reportPhaseView,
            ),
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
            report: { populate: { phases: { populate: { program: true } } } },
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
            report: { populate: { phases: { populate: { program: true } } } },
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
      const reportPhases = ((existing.report as any)?.phases ?? []) as any[];
      if (
        reportPhases.length > 0 &&
        reportPhases.every(
          (phase) => toDateString(phase.endDate) < todayIso(),
        )
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
            report: { populate: { phases: { populate: { program: true } } } },
          },
        });
      return { data: evaluationView(updated) };
    },
  }),
);
