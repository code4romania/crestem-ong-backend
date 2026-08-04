import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { computeReportScores } from "../utils/scores";
import { computeProgress } from "../../evaluation/utils/progress";
import { assignMembersSchema } from "../validation/assign-members";
import { updateReportSchema } from "../validation/report";

const reportView = (report: any) => ({
  documentId: report.documentId,
  finished: report.finished,
  evaluations: (report.evaluations ?? []).map((evaluation: any) => ({
    documentId: evaluation.documentId,
    email: evaluation.email,
    progress: computeProgress(evaluation.dimensions),
  })),
});

const todayIso = () => new Date().toISOString().slice(0, 10);

export default factories.createCoreController(
  "api::report.report",
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
        return { data: { programRounds: [], standaloneReports: [] } };
      }
      const today = todayIso();
      const programs = await strapi.documents("api::program.program").findMany({
        filters: {
          ongs: { documentId: user.ong.documentId },
          startDate: { $lte: today },
          endDate: { $gte: today },
        },
        sort: { startDate: "desc" },
        populate: { phases: true },
      });
      const programRounds = [];
      for (const program of programs) {
        const reports = await strapi.documents("api::report.report").findMany({
          filters: {
            ong: { documentId: user.ong.documentId },
            program: { documentId: program.documentId },
          },
          populate: {
            evaluations: { populate: { dimensions: true } },
            phase: true,
          },
        });
        const programEntry: any = {
          program: {
            documentId: program.documentId,
            name: program.name,
            startDate: program.startDate,
            endDate: program.endDate,
          },
        };
        const phases = [...((program.phases ?? []) as any[])].sort((a, b) =>
          `${a.startDate}`.localeCompare(`${b.startDate}`),
        );
        const reportByPhase = new Map(
          reports
            .filter((report: any) => report.phase)
            .map((report: any) => [report.phase.documentId, report]),
        );
        programEntry.phases = phases.map((phase) => ({
          documentId: phase.documentId,
          title: phase.title,
          startDate: phase.startDate,
          endDate: phase.endDate,
          hasEvaluation: phase.hasEvaluation,
          active: `${phase.startDate}` <= today && `${phase.endDate}` >= today,
          report: reportByPhase.has(phase.documentId)
            ? reportView(reportByPhase.get(phase.documentId))
            : null,
        }));
        programRounds.push(programEntry);
      }
      const unfinished = await strapi.documents("api::report.report").findMany({
        filters: { ong: { documentId: user.ong.documentId }, finished: false },
        sort: { createdAt: "desc" },
        populate: {
          program: true,
          evaluations: { populate: { dimensions: true } },
        },
      });
      const standaloneReports = unfinished
        .filter((report) => !report.program)
        .map(reportView);
      return { data: { programRounds, standaloneReports } };
    },
    async assignMembers(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignMembersSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const user = await strapi
        .documents("plugin::users-permissions.user")
        .findOne({
          documentId: ctx.state.user.documentId,
          populate: { ong: true },
        });
      if (!user?.ong) {
        return ctx.badRequest("Utilizatorul nu aparține unei organizații");
      }
      let report;
      if (parsed.data.program) {
        const program = await strapi
          .documents("api::program.program")
          .findOne({
            documentId: parsed.data.program,
            populate: { ongs: true, phases: true },
          });
        if (!program) {
          return ctx.badRequest("Programul nu există");
        }
        const participates = (program.ongs ?? []).some(
          (ong) => ong.documentId === user.ong.documentId,
        );
        if (!participates) {
          return ctx.badRequest("Organizația nu participă la acest program");
        }
        const today = todayIso();
        if (program.startDate > today || program.endDate < today) {
          return ctx.badRequest("Programul nu este activ");
        }
        const programPhases = (program.phases ?? []) as any[];
        const activePhase = programPhases.find(
          (phase) =>
            `${phase.startDate}` <= today && `${phase.endDate}` >= today,
        );
        if (!activePhase) {
          return ctx.badRequest("Nu există o fază activă");
        }
        if (!activePhase.hasEvaluation) {
          return ctx.badRequest("Faza activă nu are evaluare");
        }
        const existing = await strapi.documents("api::report.report").findMany({
          filters: {
            ong: { documentId: user.ong.documentId },
            phase: { documentId: activePhase.documentId },
          },
          limit: 1,
        });
        report =
          existing[0] ??
          (await strapi.documents("api::report.report").create({
            data: {
              finished: false,
              ong: user.ong.documentId,
              program: program.documentId,
              phase: activePhase.documentId,
            },
          }));
      } else {
        const found = await strapi.documents("api::report.report").findOne({
          documentId: parsed.data.report,
          populate: { ong: true },
        });
        if (!found || found.ong?.documentId !== user.ong.documentId) {
          return ctx.badRequest("Raportul nu există");
        }
        report = found;
      }
      if (report.finished) {
        return ctx.badRequest("Runda de evaluare este închisă");
      }
      const memberUsers = await strapi
        .documents("plugin::users-permissions.user")
        .findMany({
          filters: { documentId: { $in: parsed.data.members } },
          populate: { ong: true, role: true },
        });
      if (memberUsers.length !== parsed.data.members.length) {
        return ctx.badRequest("Unii utilizatori selectați nu există");
      }
      const invalid = memberUsers.find(
        (member) =>
          member.ong?.documentId !== user.ong.documentId ||
          member.role?.type !== "ngo-member",
      );
      if (invalid) {
        return ctx.badRequest(
          `Utilizatorul ${invalid.email} nu este membru al organizației`,
        );
      }
      const existingEvaluations = await strapi
        .documents("api::evaluation.evaluation")
        .findMany({
          filters: { report: { documentId: report.documentId } },
        });
      const existingEmails = new Set(
        existingEvaluations.map((evaluation) => evaluation.email.toLowerCase()),
      );
      const created = [];
      const skipped = [];
      for (const member of memberUsers) {
        if (existingEmails.has(member.email.toLowerCase())) {
          skipped.push(member.email);
          continue;
        }
        await strapi.documents("api::evaluation.evaluation").create({
          data: { email: member.email, report: report.documentId },
        });
        created.push(member.email);
      }
      return {
        data: {
          report: { documentId: report.documentId },
          created,
          skipped,
        },
      };
    },
    async createOne(ctx: Context) {
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
        return ctx.badRequest("Utilizatorul nu aparține unei organizații");
      }
      const created = await strapi.documents("api::report.report").create({
        data: {
          finished: false,
          ong: user.ong.documentId,
        },
      });
      return {
        data: {
          documentId: created.documentId,
          finished: created.finished,
        },
      };
    },
    async detail(ctx: Context) {
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
        return ctx.badRequest("Utilizatorul nu aparține unei organizații");
      }
      const report = await strapi.documents("api::report.report").findOne({
        documentId: ctx.params.documentId,
        populate: {
          ong: true,
          program: true,
          phase: true,
          evaluations: {
            populate: { dimensions: { populate: { quiz: true } } },
          },
        },
      });
      if (!report || report.ong?.documentId !== user.ong.documentId) {
        return ctx.badRequest("Raportul nu există");
      }
      return {
        data: {
          documentId: report.documentId,
          finished: report.finished,
          program: report.program
            ? {
                documentId: report.program.documentId,
                name: report.program.name,
              }
            : null,
          phase: report.phase
            ? {
                documentId: (report.phase as any).documentId,
                title: (report.phase as any).title,
                startDate: (report.phase as any).startDate,
                endDate: (report.phase as any).endDate,
              }
            : null,
          evaluations: (report.evaluations ?? []).map((evaluation: any) => ({
            documentId: evaluation.documentId,
            email: evaluation.email,
            progress: computeProgress(evaluation.dimensions),
          })),
          scores: computeReportScores(report.evaluations ?? []),
        },
      };
    },
    async updateOne(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = updateReportSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const user = await strapi
        .documents("plugin::users-permissions.user")
        .findOne({
          documentId: ctx.state.user.documentId,
          populate: { ong: true },
        });
      if (!user?.ong) {
        return ctx.badRequest("Utilizatorul nu aparține unei organizații");
      }
      const report = await strapi.documents("api::report.report").findOne({
        documentId: ctx.params.documentId,
        populate: { ong: true },
      });
      if (!report || report.ong?.documentId !== user.ong.documentId) {
        return ctx.badRequest("Raportul nu există");
      }
      const updated = await strapi.documents("api::report.report").update({
        documentId: report.documentId,
        data: parsed.data,
      });
      return {
        data: {
          documentId: updated.documentId,
          finished: updated.finished,
        },
      };
    },
  }),
);
