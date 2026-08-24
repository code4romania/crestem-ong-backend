import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { computeReportScores } from "../utils/scores";
import { buildProgramRounds, reportView } from "../utils/rounds";
import { computeProgress } from "../../evaluation/utils/progress";
import { hasResponses, isClosed, isProgramReport } from "../utils/lifecycle";
import { startEvaluationSchema } from "../validation/start-evaluation";
import { addMembersSchema } from "../validation/add-members";
import type { CreatedEvaluation } from "../utils/members";
import {
  createEvaluations,
  memberView,
  resolveMembers,
  sendInvites,
} from "../utils/members";
import {
  activePhase,
  findActivePhaseForOng,
  findOpenReport,
  findPhaseReport,
} from "../utils/association";
import {
  toDateString,
  toDisplayDate,
  todayInBucharest,
} from "../../../utils/date";
import { docRef } from "../../../utils/relations";
import { requireOng } from "../../../utils/ong-scope";

const todayIso = () => todayInBucharest();

const phaseView = (phase: any) => ({
  documentId: phase.documentId,
  title: phase.title,
  startDate: phase.startDate,
  endDate: phase.endDate,
  program: phase.program
    ? { documentId: phase.program.documentId, name: phase.program.name }
    : null,
});

export default factories.createCoreController(
  "api::report.report",
  ({ strapi }) => ({
    async current(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const ong = scope.ong;
      const today = todayIso();
      const programRounds = await buildProgramRounds(strapi, ong.documentId, today);
      const unfinished = await strapi.documents("api::report.report").findMany({
        filters: { ong: { documentId: ong.documentId }, finished: false },
        sort: { createdAt: "desc" },
        populate: {
          phases: true,
          evaluations: { populate: { dimensions: { populate: { quiz: true } } } },
        },
      });
      const standaloneReports = unfinished
        .filter((report) => ((report.phases ?? []) as any[]).length === 0)
        .map((report) => reportView(report, today));
      return { data: { programRounds, standaloneReports } };
    },
    async start(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = startEvaluationSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const ong = scope.ong;
      const today = todayIso();
      let phase: any = null;
      if (parsed.data.program) {
        const program = await strapi.documents("api::program.program").findOne({
          documentId: parsed.data.program,
          populate: { ongs: true, phases: true },
        });
        if (!program) {
          return ctx.badRequest("Programul nu există");
        }
        const participates = (program.ongs ?? []).some(
          (entry: any) => entry.documentId === ong.documentId,
        );
        if (!participates) {
          return ctx.badRequest("Organizația nu participă la acest program");
        }
        if (
          toDateString(program.startDate) > today ||
          toDateString(program.endDate) < today
        ) {
          return ctx.badRequest("Programul nu este activ");
        }
        phase = activePhase(program, today);
        if (!phase) {
          return ctx.badRequest("Nu există o fază de evaluare activă");
        }
        const taken = await findPhaseReport(
          strapi,
          phase.documentId,
          ong.documentId,
        );
        if (taken) {
          return ctx.badRequest(
            `Faza ${phase.title} are deja o evaluare pornită`,
          );
        }
      } else {
        const running = await findActivePhaseForOng(
          strapi,
          ong.documentId,
          today,
        );
        if (running) {
          return ctx.badRequest(
            `Ai o fază de evaluare activă în programul ${running.program.name}. Pornește evaluarea din program.`,
          );
        }
      }
      const open = await findOpenReport(strapi, ong.documentId);
      if (open) {
        return ctx.badRequest("Ai deja o evaluare în desfășurare");
      }
      const resolved = await resolveMembers(
        strapi,
        ong.documentId,
        parsed.data.members,
      );
      if ("error" in resolved) {
        return ctx.badRequest(resolved.error);
      }
      let report: any;
      let created: CreatedEvaluation[];
      try {
        const started = await strapi.db.transaction(async () => {
          const createdReport = await strapi
            .documents("api::report.report")
            .create({
              data: {
                name: `Evaluare ${toDisplayDate(today)}`,
                finished: false,
                ong: docRef(ong.documentId),
                phases: phase ? { connect: [docRef(phase.documentId)] } : [],
                originPhase: phase ? docRef(phase.documentId) : null,
              },
              populate: { phases: { populate: { program: true } } },
            });
          const createdEvaluations = await createEvaluations(
            strapi,
            createdReport.documentId,
            resolved.members,
          );
          return { report: createdReport, created: createdEvaluations };
        });
        report = started.report;
        created = started.created;
      } catch (error) {
        console.error("start evaluation failed", error);
        return ctx.badRequest("Nu s-a putut porni evaluarea. Încearcă din nou");
      }
      const invites = await sendInvites(
        strapi,
        created,
        ong.name,
        phase ? toDateString(phase.endDate) : undefined,
      );
      return {
        data: {
          report: {
            documentId: report.documentId,
            name: report.name,
            finished: isClosed(report, today),
            phases: ((report.phases ?? []) as any[]).map(phaseView),
          },
          invited: created.map((entry) => memberView(entry.member)),
          emailSent: invites.emailSent,
          emailFailed: invites.failed,
        },
      };
    },
    async addMembers(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = addMembersSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const ong = scope.ong;
      const report = await strapi.documents("api::report.report").findOne({
        documentId: ctx.params.documentId,
        populate: {
          ong: true,
          phases: true,
          evaluations: { populate: { user: true } },
        },
      });
      if (!report || report.ong?.documentId !== ong.documentId) {
        return ctx.badRequest("Runda nu există");
      }
      const today = todayIso();
      if (isClosed(report, today)) {
        return ctx.badRequest("Runda de evaluare este închisă");
      }
      const resolved = await resolveMembers(
        strapi,
        ong.documentId,
        parsed.data.members,
      );
      if ("error" in resolved) {
        return ctx.badRequest(resolved.error);
      }
      const existingUserIds = new Set(
        ((report.evaluations ?? []) as any[])
          .map((evaluation) => evaluation.user?.documentId)
          .filter(Boolean),
      );
      const fresh = resolved.members.filter(
        (member: any) => !existingUserIds.has(member.documentId),
      );
      const skipped = resolved.members
        .filter((member: any) => existingUserIds.has(member.documentId))
        .map(memberView);
      const deadline = ((report.phases ?? []) as any[])
        .map((phase) => toDateString(phase.endDate))
        .sort()
        .pop();
      let created: CreatedEvaluation[] = [];
      if (fresh.length > 0) {
        try {
          created = await strapi.db.transaction(async () =>
            createEvaluations(strapi, report.documentId, fresh),
          );
        } catch (error) {
          console.error("add members failed", error);
          return ctx.badRequest(
            "Nu s-au putut adăuga membrii. Încearcă din nou",
          );
        }
      }
      const invites =
        created.length > 0
          ? await sendInvites(strapi, created, ong.name, deadline)
          : null;
      return {
        data: {
          added: created.map((entry) => memberView(entry.member)),
          skipped,
          emailSent: invites ? invites.emailSent : null,
          emailFailed: invites ? invites.failed : [],
        },
      };
    },
    async list(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const ong = scope.ong;
      const reports = await strapi.documents("api::report.report").findMany({
        filters: { ong: { documentId: ong.documentId } },
        sort: { createdAt: "desc" },
        populate: {
          phases: { populate: { program: true } },
          evaluations: { populate: { dimensions: true } },
        },
      });
      const today = todayIso();
      return {
        data: reports.map((report: any) => {
          const closed = isClosed(report, today);
          const evaluations = (report.evaluations ?? []) as any[];
          return {
            documentId: report.documentId,
            name: report.name,
            createdAt: report.createdAt,
            finished: closed,
            finishedAt: report.finishedAt,
            closedBy: report.closedBy,
            phases: ((report.phases ?? []) as any[]).map(phaseView),
            invitedCount: evaluations.length,
            completedCount: evaluations.filter(
              (evaluation) =>
                computeProgress(evaluation.dimensions, closed).complete,
            ).length,
          };
        }),
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
      const ong = scope.ong;
      const report = await strapi.documents("api::report.report").findOne({
        documentId: ctx.params.documentId,
        populate: {
          ong: true,
          phases: true,
          evaluations: { populate: { user: true, dimensions: true } },
        },
      });
      if (!report || report.ong?.documentId !== ong.documentId) {
        return ctx.badRequest("Runda nu există");
      }
      const today = todayIso();
      const closed = isClosed(report, today);
      const invitedEvaluations = (report.evaluations ?? []).filter(
        (evaluation: any) => evaluation.user,
      ) as any[];
      const invited = invitedEvaluations
        .map((evaluation) => ({
          documentId: evaluation.documentId,
          user: memberView(evaluation.user),
          status: computeProgress(evaluation.dimensions, closed).status,
          completedAt: evaluation.completedAt ?? null,
          notificationSentAt: evaluation.notificationSentAt ?? null,
        }))
        .sort((a, b) => a.user.nume.localeCompare(b.user.nume, "ro"));
      return {
        data: {
          invited,
          invitedCount: invited.length,
          completedCount: invited.filter(
            (entry) => entry.status === "completat",
          ).length,
        },
      };
    },
    async detail(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const ong = scope.ong;
      const report = await strapi.documents("api::report.report").findOne({
        documentId: ctx.params.documentId,
        populate: {
          ong: true,
          phases: { populate: { program: true } },
          evaluations: {
            populate: { dimensions: { populate: { quiz: true } } },
          },
        },
      });
      if (!report || report.ong?.documentId !== ong.documentId) {
        return ctx.badRequest("Runda nu există");
      }
      const today = todayIso();
      const evaluations = (report.evaluations ?? []) as any[];
      const closed = isClosed(report, today);
      return {
        data: {
          documentId: report.documentId,
          name: report.name,
          createdAt: report.createdAt,
          finished: closed,
          finishedAt: report.finishedAt,
          closedBy: report.closedBy,
          canDelete: !hasResponses(report as any),
          phases: ((report.phases ?? []) as any[]).map(phaseView),
          invitedCount: evaluations.length,
          completedCount: evaluations.filter(
            (evaluation) => computeProgress(evaluation.dimensions, closed).complete,
          ).length,
          scores: computeReportScores(evaluations),
        },
      };
    },
    async finishOne(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const ong = scope.ong;
      const report = await strapi.documents("api::report.report").findOne({
        documentId: ctx.params.documentId,
        populate: { ong: true, phases: true },
      });
      if (!report || report.ong?.documentId !== ong.documentId) {
        return ctx.badRequest("Runda nu există");
      }
      if (isProgramReport(report as any)) {
        return ctx.badRequest(
          "Evaluările de program se finalizează automat la încheierea fazei",
        );
      }
      if (report.finished) {
        return ctx.badRequest("Runda este deja finalizată");
      }
      const updated = await strapi.documents("api::report.report").update({
        documentId: report.documentId,
        data: {
          finished: true,
          finishedAt: new Date().toISOString(),
          closedBy: "manual",
        },
      });
      return {
        data: {
          documentId: updated.documentId,
          finished: updated.finished,
          finishedAt: updated.finishedAt,
          closedBy: updated.closedBy,
        },
      };
    },
    async deleteOne(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const ong = scope.ong;
      const report = await strapi.documents("api::report.report").findOne({
        documentId: ctx.params.documentId,
        populate: { ong: true, evaluations: { populate: { dimensions: true } } },
      });
      if (!report || report.ong?.documentId !== ong.documentId) {
        return ctx.badRequest("Runda nu există");
      }
      if (hasResponses(report as any)) {
        return ctx.badRequest(
          "Runda are răspunsuri și nu poate fi ștearsă",
        );
      }
      for (const evaluation of (report.evaluations ?? []) as any[]) {
        await strapi
          .documents("api::evaluation.evaluation")
          .delete({ documentId: evaluation.documentId });
      }
      await strapi
        .documents("api::report.report")
        .delete({ documentId: report.documentId });
      return { message: "Runda a fost ștearsă cu succes" };
    },
  }),
);
