import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { assignMentorsSchema } from "../validation/assign-mentors";
import {
  assignOngsSchema,
  assignPhaseEvaluationSchema,
  removeOngsSchema,
} from "../validation/assign-ongs";
import {
  findPhaseReport,
  phasesOfProgram,
  phaseOfSameProgram,
  reportsInProgram,
  targetEntryPhase,
} from "../../report/utils/association";
import {
  createProgramSchema,
  updateProgramSchema,
  overlappingPhases,
  phasesOutsideProgram,
} from "../validation/program";
import { phaseLockError, programDatesLockError } from "../utils/phase-locks";
import { toDateString, todayInBucharest } from "../../../utils/date";
import { EmailService } from "../../email/services/email";

const mentorView = (mentor: any) => ({
  documentId: mentor.documentId,
  nume: mentor.nume,
  email: mentor.email,
  mentorJobTitle: mentor.mentorJobTitle ?? null,
  mentorOrganization: mentor.mentorOrganization ?? null,
  avatar: mentor.avatar
    ? {
        documentId: mentor.avatar.documentId,
        name: mentor.avatar.name,
        url: mentor.avatar.url,
      }
    : null,
});

const ongView = (ong: any) => ({
  documentId: ong.documentId,
  name: ong.name,
});

const programView = (program: any) => ({
  documentId: program.documentId,
  name: program.name,
  startDate: program.startDate,
  endDate: program.endDate,
  programStatus: program.programStatus,
});

const phaseView = (phase: any) => ({
  documentId: phase.documentId,
  title: phase.title,
  startDate: phase.startDate,
  endDate: phase.endDate,
  hasEvaluation: phase.hasEvaluation,
});

const sortedPhaseViews = (phases: any[]) =>
  [...(phases ?? [])]
    .sort((a, b) => `${a.startDate}`.localeCompare(`${b.startDate}`))
    .map(phaseView);

export default factories.createCoreController(
  "api::program.program",
  ({ strapi }) => ({
    async list(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const programs = await strapi
        .documents("api::program.program")
        .findMany({ sort: { startDate: "desc" } });
      return { data: programs.map(programView) };
    },
    async detail(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { phases: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      return {
        data: {
          ...programView(program),
          phases: sortedPhaseViews(program.phases as any[]),
        },
      };
    },
    async createOne(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = createProgramSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const duplicate = await strapi.db
        .query("api::program.program")
        .findOne({ where: { name: { $eqi: parsed.data.name } } });
      if (duplicate) {
        return ctx.badRequest("Există deja un program cu acest nume");
      }
      const { phases, ...programData } = parsed.data;
      if (
        phasesOutsideProgram(phases, programData.startDate, programData.endDate)
      ) {
        return ctx.badRequest(
          "Fazele trebuie să se încadreze în intervalul programului",
        );
      }
      const overlap = overlappingPhases(phases);
      if (overlap) {
        return ctx.badRequest(
          `Fazele ${overlap.earlier.title} și ${overlap.later.title} se suprapun`,
        );
      }
      try {
        const created = await strapi.documents("api::program.program").create({
          data: programData,
        });
        const createdPhases = [];
        for (const phase of phases) {
          createdPhases.push(
            await strapi.documents("api::phase.phase").create({
              data: { ...phase, program: created.documentId },
            }),
          );
        }
        return {
          data: {
            ...programView(created),
            phases: sortedPhaseViews(createdPhases),
          },
        };
      } catch (error) {
        if (
          error?.name === "ValidationError" &&
          `${error.message}`.includes("unique")
        ) {
          return ctx.badRequest("Există deja un program cu acest nume");
        }
        console.error("program createOne failed", error);
        return ctx.badRequest(
          "A apărut o eroare neașteptată. Te rugăm să încerci din nou mai târziu.",
        );
      }
    },
    async updateOne(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = updateProgramSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const existing = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { phases: { populate: { reports: true } } },
      });
      if (!existing) {
        return ctx.badRequest("Programul nu există");
      }
      if (parsed.data.name !== undefined) {
        const duplicate = await strapi.db
          .query("api::program.program")
          .findOne({
            where: {
              name: { $eqi: parsed.data.name },
              documentId: { $ne: existing.documentId },
            },
          });
        if (duplicate) {
          return ctx.badRequest("Există deja un program cu acest nume");
        }
      }
      const startDate = parsed.data.startDate ?? existing.startDate;
      const endDate = parsed.data.endDate ?? existing.endDate;
      if (endDate < startDate) {
        return ctx.badRequest("Data de sfârșit este înaintea datei de început");
      }
      const existingPhases = (existing.phases ?? []) as any[];
      const { phases, removePhases, ...programData } = parsed.data;
      const today = todayInBucharest();
      const started = toDateString(existing.startDate) <= today;
      if (started) {
        const datesError = programDatesLockError(existing, parsed.data, today);
        if (datesError) {
          return ctx.badRequest(datesError);
        }
      }
      let removedPhases: any[] = [];
      if (phases) {
        if (phasesOutsideProgram(phases, `${startDate}`, `${endDate}`)) {
          return ctx.badRequest(
            "Fazele trebuie să se încadreze în intervalul programului",
          );
        }
        const byId = new Map(
          existingPhases.map((phase) => [phase.documentId, phase]),
        );
        const missing = phases.find(
          (phase) => phase.documentId && !byId.has(phase.documentId),
        );
        if (missing) {
          return ctx.badRequest(
            `Faza ${missing.title} nu există în acest program`,
          );
        }
        const removeIds = new Set(removePhases ?? []);
        const unknownRemoval = [...removeIds].find((id) => !byId.has(id));
        if (unknownRemoval) {
          return ctx.badRequest("O fază de șters nu există în acest program");
        }
        const keptIds = new Set(
          phases.map((phase) => phase.documentId).filter(Boolean),
        );
        const contradictory = [...removeIds].find((id) => keptIds.has(id));
        if (contradictory) {
          return ctx.badRequest(
            `Faza ${byId.get(contradictory).title} apare și în lista de faze păstrate, și în cea de ștergere`,
          );
        }
        const unaccounted = existingPhases.filter(
          (phase) =>
            !keptIds.has(phase.documentId) && !removeIds.has(phase.documentId),
        );
        if (unaccounted.length > 0) {
          const titles = unaccounted.map((phase) => phase.title).join(", ");
          return ctx.badRequest(
            unaccounted.length === 1
              ? `Faza ${titles} lipsește din listă. Trimite-o pentru a o păstra sau adaug-o în removePhases pentru a o șterge`
              : `Fazele ${titles} lipsesc din listă. Trimite-le pentru a le păstra sau adaugă-le în removePhases pentru a le șterge`,
          );
        }
        if (started) {
          const lockError = phaseLockError(existingPhases, phases, today);
          if (lockError) {
            return ctx.badRequest(lockError);
          }
        }
        const overlap = overlappingPhases(phases);
        if (overlap) {
          return ctx.badRequest(
            `Fazele ${overlap.earlier.title} și ${overlap.later.title} se suprapun`,
          );
        }
        removedPhases = existingPhases.filter((phase) =>
          removeIds.has(phase.documentId),
        );
        const blocked = removedPhases.find(
          (phase) => (phase.reports ?? []).length > 0,
        );
        if (blocked) {
          return ctx.badRequest(
            `Faza ${blocked.title} are rapoarte și nu poate fi ștearsă`,
          );
        }
        const disabled = phases.find((phase) => {
          if (!phase.documentId || phase.hasEvaluation) {
            return false;
          }
          const current = byId.get(phase.documentId);
          return current?.hasEvaluation && (current.reports ?? []).length > 0;
        });
        if (disabled) {
          return ctx.badRequest(
            `Faza ${disabled.title} are rapoarte și evaluarea nu poate fi dezactivată`,
          );
        }
      } else if (
        existingPhases.length > 0 &&
        phasesOutsideProgram(existingPhases, `${startDate}`, `${endDate}`)
      ) {
        return ctx.badRequest(
          "Fazele existente nu se încadrează în noile date ale programului",
        );
      }
      try {
        if (Object.keys(programData).length > 0) {
          await strapi.documents("api::program.program").update({
            documentId: existing.documentId,
            data: programData,
          });
        }
        if (phases) {
          for (const phase of removedPhases) {
            await strapi
              .documents("api::phase.phase")
              .delete({ documentId: phase.documentId });
          }
          for (const phase of phases) {
            if (phase.documentId) {
              await strapi.documents("api::phase.phase").update({
                documentId: phase.documentId,
                data: {
                  title: phase.title,
                  startDate: phase.startDate,
                  endDate: phase.endDate,
                  hasEvaluation: phase.hasEvaluation,
                },
              });
            } else {
              await strapi.documents("api::phase.phase").create({
                data: { ...phase, program: existing.documentId },
              });
            }
          }
        }
        const refreshed = await strapi
          .documents("api::program.program")
          .findOne({
            documentId: existing.documentId,
            populate: { phases: true },
          });
        return {
          data: {
            ...programView(refreshed),
            phases: sortedPhaseViews(refreshed.phases as any[]),
          },
        };
      } catch (error) {
        if (
          error?.name === "ValidationError" &&
          `${error.message}`.includes("unique")
        ) {
          return ctx.badRequest("Există deja un program cu acest nume");
        }
        console.error("program updateOne failed", error);
        return ctx.badRequest(
          "A apărut o eroare neașteptată. Te rugăm să încerci din nou mai târziu.",
        );
      }
    },
    async deleteOne(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const existing = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { phases: { populate: { reports: true } } },
      });
      if (!existing) {
        return ctx.badRequest("Programul nu există");
      }
      const withReports = ((existing.phases ?? []) as any[]).some(
        (phase) => (phase.reports ?? []).length > 0,
      );
      if (withReports) {
        return ctx.badRequest("Programul are rapoarte și nu poate fi șters");
      }
      for (const phase of (existing.phases ?? []) as any[]) {
        await strapi
          .documents("api::phase.phase")
          .delete({ documentId: phase.documentId });
      }
      await strapi
        .documents("api::program.program")
        .delete({ documentId: existing.documentId });
      return { message: "Programul a fost șters cu succes" };
    },
    async mentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { mentors: { populate: { avatar: true } } },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      return { data: (program.mentors ?? []).map(mentorView) };
    },
    async ongs(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      return { data: { ongs: ((program.ongs ?? []) as any[]).map(ongView) } };
    },
    async assignMentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignMentorsSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: parsed.data.program,
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const mentorIds = [...new Set(parsed.data.mentors)];
      const mentorUsers = await strapi
        .documents("plugin::users-permissions.user")
        .findMany({
          filters: { documentId: { $in: mentorIds } },
          populate: { role: true },
        });
      if (mentorUsers.length !== mentorIds.length) {
        return ctx.badRequest("Unii utilizatori selectați nu există");
      }
      const invalid = mentorUsers.find(
        (mentor) =>
          mentor.role?.type !== "mentor" ||
          mentor.accountStatus !== "active" ||
          mentor.blocked,
      );
      if (invalid) {
        return ctx.badRequest(
          `Utilizatorul ${invalid.email} nu este un mentor activ`,
        );
      }
      const updated = await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { mentors: { connect: mentorIds } },
        populate: { mentors: { populate: { avatar: true } } },
      });
      return { data: { mentors: (updated.mentors ?? []).map(mentorView) } };
    },
    async removeMentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignMentorsSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: parsed.data.program,
        populate: { mentors: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const mentorIds = [...new Set(parsed.data.mentors)];
      const assigned = new Set(
        ((program.mentors ?? []) as any[]).map((mentor) => mentor.documentId),
      );
      const outsiderIds = mentorIds.filter((id) => !assigned.has(id));
      if (outsiderIds.length > 0) {
        const outsiders = await strapi
          .documents("plugin::users-permissions.user")
          .findMany({ filters: { documentId: { $in: outsiderIds } } });
        return ctx.badRequest(
          outsiders.length > 0
            ? `Mentorul ${outsiders[0].email} nu este asignat acestui program`
            : "Mentorul nu există",
        );
      }
      await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { mentors: { disconnect: mentorIds } },
      });
      return { message: "Mentorii au fost eliminați din program" };
    },
    async assignOngs(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignOngsSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: parsed.data.program,
        populate: { ongs: true, phases: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const entries = parsed.data.ongs;
      const ongIds = [...new Set(entries.map((entry) => entry.ong))];
      if (ongIds.length !== entries.length) {
        return ctx.badRequest("O organizație apare de mai multe ori");
      }
      const ongs = await strapi.documents("api::ong.ong").findMany({
        filters: { documentId: { $in: ongIds } },
      });
      if (ongs.length !== ongIds.length) {
        return ctx.badRequest("Unele organizații selectate nu există");
      }
      const invalid = ongs.find((ong) => ong.ngoStatus !== "active");
      if (invalid) {
        return ctx.badRequest(`Organizația ${invalid.name} nu este activă`);
      }
      const alreadyAssigned = new Set(
        ((program.ongs ?? []) as any[]).map((ong) => ong.documentId),
      );
      const duplicateOng = ongs.find((ong) =>
        alreadyAssigned.has(ong.documentId),
      );
      if (duplicateOng) {
        return ctx.badRequest(
          `Organizația ${duplicateOng.name} este deja parte din acest program`,
        );
      }
      const ongByDocumentId = new Map(ongs.map((ong) => [ong.documentId, ong]));
      const picks = entries.filter((entry) => entry.report);
      const entryPhase = targetEntryPhase(program, todayInBucharest());
      if (picks.length > 0 && !entryPhase) {
        return ctx.badRequest(
          "Programul nu are o fază care să accepte evaluare",
        );
      }
      for (const pick of picks) {
        const ong = ongByDocumentId.get(pick.ong);
        const report = await strapi.documents("api::report.report").findOne({
          documentId: pick.report,
          populate: { ong: true, phases: { populate: { program: true } } },
        });
        if (!report || report.ong?.documentId !== pick.ong) {
          return ctx.badRequest(
            `Evaluarea nu aparține organizației ${ong?.name}`,
          );
        }
        const clash = phaseOfSameProgram(report, program.documentId);
        if (clash) {
          return ctx.badRequest(
            `Evaluarea este deja asociată fazei ${clash.title} din acest program`,
          );
        }
        const taken = await findPhaseReport(
          strapi,
          entryPhase.documentId,
          pick.ong,
        );
        if (taken) {
          return ctx.badRequest(
            `Faza ${entryPhase.title} are deja o evaluare pentru organizația ${ong?.name}`,
          );
        }
      }
      const updated = await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { ongs: { connect: ongIds } },
        populate: { ongs: true },
      });
      for (const pick of picks) {
        await strapi.documents("api::report.report").update({
          documentId: pick.report,
          data: { phases: { connect: [entryPhase.documentId] } },
        });
      }
      let emailSent = true;
      for (const ong of ongs) {
        const admins = await strapi
          .documents("plugin::users-permissions.user")
          .findMany({
            filters: {
              ong: { documentId: ong.documentId },
              role: { type: "ngo-admin" },
              accountStatus: "active",
              blocked: false,
            },
          });
        for (const admin of admins) {
          try {
            await (
              strapi.service("api::email.email") as EmailService
            ).sendProgramAssignment({
              to: admin.email,
              nume: admin.nume,
              ongName: ong.name,
              programName: program.name,
            });
          } catch (error) {
            console.error("assignOngs email delivery failed", error);
            emailSent = false;
          }
        }
      }
      return { data: { ongs: (updated.ongs ?? []).map(ongView), emailSent } };
    },
    async assignPhaseEvaluation(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignPhaseEvaluationSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { ongs: true, phases: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const phase = ((program.phases ?? []) as any[]).find(
        (candidate) => candidate.documentId === ctx.params.phaseDocumentId,
      );
      if (!phase) {
        return ctx.badRequest("Faza nu aparține acestui program");
      }
      if (!phase.hasEvaluation) {
        return ctx.badRequest("Faza nu necesită evaluare");
      }
      const participates = ((program.ongs ?? []) as any[]).some(
        (ong) => ong.documentId === parsed.data.ong,
      );
      if (!participates) {
        return ctx.badRequest("Organizația nu participă la acest program");
      }
      const taken = await findPhaseReport(
        strapi,
        phase.documentId,
        parsed.data.ong,
      );
      if (taken) {
        return ctx.badRequest(
          "Faza are deja o evaluare pentru această organizație",
        );
      }
      const report = await strapi.documents("api::report.report").findOne({
        documentId: parsed.data.report,
        populate: { ong: true, phases: { populate: { program: true } } },
      });
      if (!report || report.ong?.documentId !== parsed.data.ong) {
        return ctx.badRequest("Evaluarea nu aparține organizației");
      }
      if (
        toDateString(phase.endDate) < todayInBucharest() &&
        !report.finished
      ) {
        return ctx.badRequest(
          "Faza s-a încheiat; poți asocia doar evaluări finalizate",
        );
      }
      const clash = phaseOfSameProgram(report, program.documentId);
      if (clash) {
        return ctx.badRequest(
          `Evaluarea este deja asociată fazei ${clash.title} din acest program`,
        );
      }
      await strapi.documents("api::report.report").update({
        documentId: report.documentId,
        data: { phases: { connect: [phase.documentId] } },
      });
      return {
        data: {
          phase: { documentId: phase.documentId, title: phase.title },
          report: { documentId: report.documentId },
        },
      };
    },
    async removePhaseEvaluation(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { phases: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const phase = ((program.phases ?? []) as any[]).find(
        (candidate) => candidate.documentId === ctx.params.phaseDocumentId,
      );
      if (!phase) {
        return ctx.badRequest("Faza nu aparține acestui program");
      }
      const report = await findPhaseReport(
        strapi,
        phase.documentId,
        ctx.params.ongDocumentId,
      );
      if (!report) {
        return ctx.badRequest(
          "Faza nu are o evaluare pentru această organizație",
        );
      }
      const stored = await strapi.documents("api::report.report").findOne({
        documentId: report.documentId,
        populate: { originPhase: true },
      });
      const bornHere =
        (stored?.originPhase as any)?.documentId === phase.documentId;
      await strapi.documents("api::report.report").update({
        documentId: report.documentId,
        data: {
          phases: { disconnect: [phase.documentId] },
          ...(bornHere ? { originPhase: null } : {}),
        },
      });
      return { message: "Evaluarea a fost desprinsă de fază" };
    },
    async removeOngs(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = removeOngsSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: parsed.data.program,
        populate: { ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const ongIds = [...new Set(parsed.data.ongs)];
      const participating = new Set(
        ((program.ongs ?? []) as any[]).map((ong) => ong.documentId),
      );
      const outsiderIds = ongIds.filter((id) => !participating.has(id));
      if (outsiderIds.length > 0) {
        const outsiders = await strapi.documents("api::ong.ong").findMany({
          filters: { documentId: { $in: outsiderIds } },
        });
        return ctx.badRequest(
          outsiders.length > 0
            ? `Organizația ${outsiders[0].name} nu participă la acest program`
            : "Organizația nu există",
        );
      }
      const removing = new Set(ongIds);
      const reports = (
        await reportsInProgram(strapi, program.documentId)
      ).filter((report) => removing.has(report.ong?.documentId));
      for (const report of reports) {
        const phaseIds = phasesOfProgram(report, program.documentId);
        if (phaseIds.length === 0) {
          continue;
        }
        const bornHere =
          report.originPhase?.program?.documentId === program.documentId;
        await strapi.documents("api::report.report").update({
          documentId: report.documentId,
          data: {
            phases: { disconnect: phaseIds },
            ...(bornHere ? { originPhase: null } : {}),
          },
        });
      }
      await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { ongs: { disconnect: ongIds } },
      });
      return { message: "Organizațiile au fost eliminate din program" };
    },
  }),
);
