import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { evaluationDimensionsSchema } from "../validation/evaluation";
import { computeProgress } from "../utils/progress";
import { normalizeBlocks } from "../utils/normalize";
import { decorateBlock } from "../utils/catalog";
import { allPhasesEnded } from "../../report/utils/association";
import { memberView } from "../../report/utils/members";
import { isClosed } from "../../report/utils/lifecycle";
import { todayInBucharest } from "../../../utils/date";
import { belongsToOng, loadUserWithOngs } from "../../../utils/ong-scope";
import {
  getNgoMemberRolesForUser,
  removeOngMembership,
} from "../../../utils/membership";
import { computeEvaluationScores } from "../../report/utils/scores";
import { buildProgramRounds } from "../../report/utils/rounds";
import { ngoMentorsFor } from "../../../utils/ngo-mentors";

const reportPhaseView = (phase: any) => ({
  documentId: phase.documentId,
  title: phase.title,
  startDate: phase.startDate,
  endDate: phase.endDate,
  program: phase.program
    ? { documentId: phase.program.documentId, name: phase.program.name }
    : null,
});

/**
 * The same projection as the report member list. An anonymized respondent must
 * not leak the `deleted-<documentId>@anonim.local` placeholder as if it were a
 * real address (BR-27); reusing `memberView` — identical shape, already
 * `isAnonymized`-aware — keeps the three read paths in agreement instead of
 * repeating the check a third time.
 */
const respondentView = (user: any) => (user ? memberView(user) : null);

const evaluationView = (evaluation: any, today: string) => ({
  documentId: evaluation.documentId,
  user: respondentView(evaluation.user),
  progress: computeProgress(
    evaluation.dimensions,
    isClosed(evaluation.report, today),
  ),
  completedAt: evaluation.completedAt ?? null,
  scores: computeEvaluationScores(evaluation),
  dimensions: (evaluation.dimensions ?? []).map(decorateBlock),
  report: evaluation.report
    ? {
        documentId: evaluation.report.documentId,
        name: evaluation.report.name,
        createdAt: evaluation.report.createdAt,
        finished: evaluation.report.finished,
        finishedAt: evaluation.report.finishedAt ?? null,
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
          .filter(
            (evaluation: any) => !allPhasesEnded(evaluation.report, today),
          )
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
          populate: {
            ong: { populate: { programs: true, domeniuPrincipal: true } },
          },
        });
      const roles = await getNgoMemberRolesForUser(
        strapi,
        ctx.state.user.documentId,
      );
      return {
        data: ((user?.ong ?? []) as any[])
          .filter(Boolean)
          .map((ong: any) => ({
            documentId: ong.documentId,
            name: ong.name,
            cui: ong.cui,
            website: ong.website ?? null,
            adresa: ong.adresa ?? null,
            dataInfiintare: ong.dataInfiintare ?? null,
            domeniuActivitate: ong.domeniuPrincipal?.name ?? null,
            rol: roles.get(ong.documentId) ?? null,
            programs: ((ong.programs ?? []) as any[]).map((program) => ({
              documentId: program.documentId,
              name: program.name,
              programStatus: program.programStatus,
            })),
          }))
          .sort((a, b) => `${a.name}`.localeCompare(`${b.name}`, "ro")),
      };
    },
    /**
     * The member-side twin of `/reports/current`, scoped to one of the
     * organizations the caller belongs to. Same `programRounds` payload, so
     * both dashboards compute their Overview counters from identical data.
     * `standaloneReports` is deliberately left out: only an ngo-admin can
     * start an independent evaluation, so it has nothing to say here.
     */
    async ongRounds(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      if (!user) {
        return ctx.unauthorized();
      }
      const ongDocumentId = ctx.params.ongDocumentId;
      if (!belongsToOng(user, ongDocumentId)) {
        return ctx.badRequest("Nu faci parte din această organizație");
      }
      const programRounds = await buildProgramRounds(
        strapi,
        ongDocumentId,
        todayIso(),
      );
      return { data: { programRounds } };
    },
    /** The persoane resursă of the caller's organization inside one program. */
    async ongMentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      if (!user) {
        return ctx.unauthorized();
      }
      const ongDocumentId = ctx.params.ongDocumentId;
      if (!belongsToOng(user, ongDocumentId)) {
        return ctx.badRequest("Nu faci parte din această organizație");
      }
      const programDocumentId = (ctx.query as any)?.program;
      if (typeof programDocumentId !== "string" || !programDocumentId) {
        return ctx.badRequest("Programul este obligatoriu");
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: programDocumentId,
        populate: { mentors: true, ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const participates = ((program.ongs ?? []) as any[]).some(
        (entry) => entry.documentId === ongDocumentId,
      );
      if (!participates) {
        return ctx.forbidden("Organizația ta nu participă la acest program");
      }
      return { data: await ngoMentorsFor(strapi, program, ongDocumentId) };
    },
    async leaveOng(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const user = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      if (!user) {
        return ctx.unauthorized();
      }
      if (!belongsToOng(user, ctx.params.ongDocumentId)) {
        return ctx.badRequest("Nu faci parte din această organizație");
      }
      const result = await removeOngMembership(
        strapi,
        user.documentId,
        ctx.params.ongDocumentId,
      );
      if ("error" in result) {
        return ctx.badRequest(result.error);
      }
      return { data: result.data };
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
      if (existing.completedAt) {
        return ctx.badRequest("Evaluarea a fost deja finalizată");
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
      const updated = await strapi
        .documents("api::evaluation.evaluation")
        .update({
          documentId: existing.documentId,
          data: { dimensions },
          populate: {
            dimensions: { populate: { quiz: true } },
            user: true,
            report: { populate: { phases: { populate: { program: true } } } },
          },
        });
      return { data: evaluationView(updated, today) };
    },
    async finish(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
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
      if (existing.completedAt) {
        return ctx.badRequest("Evaluarea a fost deja finalizată");
      }
      if (!computeProgress(existing.dimensions).complete) {
        return ctx.badRequest("Nu ai completat toate dimensiunile încă");
      }
      const updated = await strapi
        .documents("api::evaluation.evaluation")
        .update({
          documentId: existing.documentId,
          data: { completedAt: new Date().toISOString() },
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
