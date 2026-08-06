import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { evaluationDimensionsSchema } from "../validation/evaluation";
import { computeProgress } from "../utils/progress";
import { normalizeBlocks } from "../utils/normalize";
import { decorateBlock } from "../utils/catalog";
import { allPhasesEnded } from "../../report/utils/association";
import { isClosed } from "../../report/utils/lifecycle";
import { todayInBucharest } from "../../../utils/date";
import { belongsToOng, loadUserWithOngs } from "../../../utils/ong-scope";
import { computeEvaluationScores } from "../../report/utils/scores";

const reportPhaseView = (phase: any) => ({
  documentId: phase.documentId,
  title: phase.title,
  startDate: phase.startDate,
  endDate: phase.endDate,
  program: phase.program
    ? { documentId: phase.program.documentId, name: phase.program.name }
    : null,
});

const respondentView = (user: any) =>
  user
    ? { documentId: user.documentId, nume: user.nume, email: user.email }
    : null;

const evaluationView = (evaluation: any, today: string) => ({
  documentId: evaluation.documentId,
  user: respondentView(evaluation.user),
  progress: computeProgress(
    evaluation.dimensions,
    isClosed(evaluation.report, today),
  ),
  completedAt: evaluation.completedAt ?? null,
  dimensions: (evaluation.dimensions ?? []).map(decorateBlock),
  report: evaluation.report
    ? {
        documentId: evaluation.report.documentId,
        name: evaluation.report.name,
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
      const evaluations = await strapi
        .documents("api::evaluation.evaluation")
        .findMany({
          filters: {
            user: { documentId: ctx.state.user.documentId },
            report: { finished: false },
          },
          sort: { createdAt: "desc" },
          populate: {
            dimensions: true,
            user: true,
            report: {
              populate: { ong: true, phases: { populate: { program: true } } },
            },
          },
        });
      const today = todayIso();
      return {
        data: evaluations
          .filter((evaluation: any) => !allPhasesEnded(evaluation.report, today))
          .map((evaluation: any) => ({
            documentId: evaluation.documentId,
            user: respondentView(evaluation.user),
            ong: evaluation.report?.ong
              ? {
                  documentId: evaluation.report.ong.documentId,
                  name: evaluation.report.ong.name,
                }
              : null,
            report: {
              documentId: evaluation.report?.documentId,
              name: evaluation.report?.name,
              phases: ((evaluation.report?.phases ?? []) as any[]).map(
                reportPhaseView,
              ),
            },
            progress: computeProgress(
              evaluation.dimensions,
              isClosed(evaluation.report, today),
            ),
          })),
      };
    },
    async myOngs(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const user = await strapi
        .documents("plugin::users-permissions.user")
        .findOne({
          documentId: ctx.state.user.documentId,
          populate: { ongs: { populate: { programs: true } } },
        });
      return {
        data: ((user?.ongs ?? []) as any[])
          .map((ong) => ({
            documentId: ong.documentId,
            name: ong.name,
            cui: ong.cui,
            programs: ((ong.programs ?? []) as any[]).map((program) => ({
              documentId: program.documentId,
              name: program.name,
              programStatus: program.programStatus,
            })),
          }))
          .sort((a, b) => `${a.name}`.localeCompare(`${b.name}`, "ro")),
      };
    },
    async myEvaluations(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      if (!belongsToOng(user, ctx.params.ongDocumentId)) {
        return ctx.forbidden("Nu ai acces la această organizație");
      }
      const evaluations = await strapi
        .documents("api::evaluation.evaluation")
        .findMany({
          filters: {
            user: { documentId: user.documentId },
            report: { ong: { documentId: ctx.params.ongDocumentId } },
          },
          sort: { createdAt: "desc" },
          populate: {
            dimensions: { populate: { quiz: true } },
            report: { populate: { phases: { populate: { program: true } } } },
          },
        });
      const today = todayIso();
      return {
        data: evaluations.map((evaluation: any) => {
          const closed = isClosed(evaluation.report, today);
          return {
            documentId: evaluation.documentId,
            name: evaluation.report?.name ?? null,
            completedAt: evaluation.completedAt ?? null,
            progress: computeProgress(evaluation.dimensions, closed),
            scores: computeEvaluationScores(evaluation),
            report: evaluation.report
              ? {
                  documentId: evaluation.report.documentId,
                  finished: closed,
                  phases: ((evaluation.report.phases ?? []) as any[]).map(
                    reportPhaseView,
                  ),
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
      const evaluation = await strapi
        .documents("api::evaluation.evaluation")
        .findOne({
          documentId: ctx.params.documentId,
          populate: {
            dimensions: { populate: { quiz: true } },
            user: true,
            report: { populate: { phases: { populate: { program: true } } } },
          },
        });
      if (!evaluation) {
        return ctx.badRequest("Evaluarea nu există");
      }
      if (evaluation.user?.documentId !== ctx.state.user.documentId) {
        return ctx.forbidden("Nu ai acces la această evaluare");
      }
      return { data: evaluationView(evaluation, todayIso()) };
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
            user: true,
            report: { populate: { phases: { populate: { program: true } } } },
          },
        });
      if (!existing) {
        return ctx.badRequest("Evaluarea nu există");
      }
      if (existing.user?.documentId !== ctx.state.user.documentId) {
        return ctx.forbidden("Nu ai acces la această evaluare");
      }
      if (existing.report?.finished) {
        return ctx.badRequest("Runda de evaluare este închisă");
      }
      const today = todayIso();
      if (allPhasesEnded(existing.report, today)) {
        return ctx.badRequest("Termenul fazei de evaluare a expirat");
      }
      const saved = (existing.dimensions ?? []).map((block: any) => ({
        dimensionKey: block.dimensionKey,
        comment: block.comment ?? "",
        submitted: Boolean(block.submitted),
        quiz: (block.quiz ?? []).map((question: any) => ({
          questionId: question.questionId,
          answer: question.answer,
        })),
      }));
      const lockedKeys = new Set(
        saved
          .filter((block: any) => block.submitted)
          .map((block: any) => block.dimensionKey),
      );
      const resubmitted = parsed.data.find((block) =>
        lockedKeys.has(block.dimensionKey),
      );
      if (resubmitted) {
        return ctx.badRequest(
          `Dimensiunea ${resubmitted.dimensionKey} a fost deja trimisă`,
        );
      }
      const incoming = parsed.data.map((block) => ({
        dimensionKey: block.dimensionKey,
        comment: block.comment,
        submitted: block.submit,
        quiz: block.quiz,
      }));
      const incomingKeys = new Set(
        incoming.map((block) => block.dimensionKey as string),
      );
      const dimensions = normalizeBlocks([
        ...saved.filter((block: any) => !incomingKeys.has(block.dimensionKey)),
        ...incoming,
      ]);
      const completedAt =
        computeProgress(dimensions).complete && !existing.completedAt
          ? new Date().toISOString()
          : undefined;
      const updated = await strapi
        .documents("api::evaluation.evaluation")
        .update({
          documentId: existing.documentId,
          data: completedAt ? { dimensions, completedAt } : { dimensions },
          populate: {
            dimensions: { populate: { quiz: true } },
            user: true,
            report: { populate: { phases: { populate: { program: true } } } },
          },
        });
      return { data: evaluationView(updated, today) };
    },
  }),
);
