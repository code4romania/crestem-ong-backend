import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { assignMentorsSchema } from "../validation/assign-mentors";
import { assignOngMentorsSchema } from "../validation/assign-ong-mentors";
import {
  assignOngsSchema,
  assignPhaseEvaluationSchema,
  removeOngsSchema,
} from "../validation/assign-ongs";
import {
  findPhaseReport,
  phaseEndedForUnfinishedReport,
  phaseEvaluationsView,
  phasesOfProgram,
  phaseOfSameProgram,
  reportsInProgram,
  resolvePickPhase,
  targetEntryPhase,
} from "../../report/utils/association";
import { isClosed } from "../../report/utils/lifecycle";
import { docRef, docRefs } from "../../../utils/relations";
import {
  createProgramSchema,
  updateProgramSchema,
  overlappingPhases,
  phasesOutsideProgram,
} from "../validation/program";
import {
  phaseLockError,
  programDatesLockError,
  programFinishedError,
} from "../utils/phase-locks";
import { toDateString, todayInBucharest } from "../../../utils/date";
import { isFdscStaff } from "../../../utils/fdsc-staff";
import { computeProgramStatus } from "../utils/status";
import { EmailService } from "../../email/services/email";
import { requireOng } from "../../../utils/ong-scope";
import { mentorView, ngoMentorsFor } from "../../../utils/ngo-mentors";
import { isAnonymized } from "../../../utils/anonymize";

const ongView = (ong: any) => ({
  documentId: ong.documentId,
  name: ong.name,
  // Drives the "Retras" badge: an ONG deleted while enrolled stays in the
  // program with its reports and scores intact (BR-33).
  ngoStatus: ong.ngoStatus,
});

const programView = (program: any) => ({
  documentId: program.documentId,
  name: program.name,
  startDate: program.startDate,
  endDate: program.endDate,
  // Recomputed on read: the stored column only refreshes when the dates are
  // edited, so a program that simply ran out of days still reads "Active".
  programStatus: computeProgramStatus(
    toDateString(program.startDate),
    toDateString(program.endDate),
    todayInBucharest(),
  ),
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

const findOrCreateNgoMentorRow = async (strapi: any, programId: string, ongId: string) => {
  const existing = await strapi.documents("api::ngo-mentor.ngo-mentor").findFirst({
    filters: {
      program: { documentId: programId },
      ong: { documentId: ongId },
    },
    populate: { mentors: { populate: { avatar: true } } },
  });
  if (existing) {
    return existing;
  }
  return strapi.documents("api::ngo-mentor.ngo-mentor").create({
    data: {
      program: { connect: [programId] },
      ong: { connect: [ongId] },
    },
    populate: { mentors: { populate: { avatar: true } } },
  });
};

export default factories.createCoreController(
  "api::program.program",
  ({ strapi }) => ({
    async list(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const programs = await strapi
        .documents("api::program.program")
        .findMany({
          sort: { startDate: "desc" },
          populate: { phases: true },
        });
      return {
        data: programs.map((program) => ({
          ...programView(program),
          phases: sortedPhaseViews(program.phases as any[]),
        })),
      };
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
      const entryPhase = targetEntryPhase(program, todayInBucharest());
      return {
        data: {
          ...programView(program),
          phases: sortedPhaseViews(program.phases as any[]),
          entryPhase: entryPhase
            ? { documentId: entryPhase.documentId, title: entryPhase.title }
            : null,
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
              data: { ...phase, program: docRef(created.documentId) },
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
      const finishedError = programFinishedError(existing, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
                data: { ...phase, program: docRef(existing.documentId) },
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
      const finishedError = programFinishedError(existing, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
    async stats(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { ongs: true, mentors: true, phases: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const today = todayInBucharest();
      const ongIds = ((program.ongs ?? []) as any[]).map(
        (ong) => ong.documentId,
      );

      const reports = await reportsInProgram(strapi, program.documentId);
      const reportsByOng = new Map<string, any[]>();
      for (const report of reports) {
        const ongId = report.ong?.documentId;
        if (!ongId) {
          continue;
        }
        if (!reportsByOng.has(ongId)) {
          reportsByOng.set(ongId, []);
        }
        reportsByOng.get(ongId).push(report);
      }

      // Per ONG: an open report means it's still being evaluated; once every
      // report is closed, the ONG counts as "finalized".
      let inEvaluation = 0;
      let finalizedEvaluation = 0;
      for (const ongId of ongIds) {
        const ongReports = reportsByOng.get(ongId) ?? [];
        if (ongReports.length === 0) {
          continue;
        }
        if (ongReports.some((report) => !isClosed(report, today))) {
          inEvaluation += 1;
          continue;
        }
        finalizedEvaluation += 1;
      }

      return {
        data: {
          ongsCount: ongIds.length,
          // Mentors who deleted their account stay assigned so their history
          // stays readable (BR-34), but they are nobody's resource any more —
          // counting them would show a program as staffed when it is not.
          mentorsCount: ((program.mentors ?? []) as any[]).filter(
            (mentor) => !isAnonymized(mentor),
          ).length,
          inEvaluation,
          finalizedEvaluation,
        },
      };
    },
    async mentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { mentors: { populate: { avatar: true } }, ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      if (!isFdscStaff(ctx.state.user.role?.type)) {
        const scope = await requireOng(strapi, ctx);
        if ("error" in scope) {
          return ctx.badRequest(scope.error);
        }
        const participates = (program.ongs ?? []).some(
          (entry: any) => entry.documentId === scope.ong.documentId,
        );
        if (!participates) {
          return ctx.forbidden("Organizația ta nu participă la acest program");
        }
      }
      return { data: (program.mentors ?? []).map(mentorView) };
    },
    /**
     * The mentors assigned to the *calling* organization inside a program, as
     * opposed to `mentors`, which lists everybody working on the program.
     * Reads the (ong, program) `ngo-mentor` row and, like `ongs`, drops mentors
     * who were since removed from the program itself — the row keeps them.
     */
    async ongMentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { mentors: true, ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const scope = await requireOng(strapi, ctx);
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }
      const participates = ((program.ongs ?? []) as any[]).some(
        (entry) => entry.documentId === scope.ong.documentId,
      );
      if (!participates) {
        return ctx.forbidden("Organizația ta nu participă la acest program");
      }
      return { data: await ngoMentorsFor(strapi, program, scope.ong.documentId) };
    },
    async ongs(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { ongs: true, mentors: true, phases: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const programMentorIds = new Set(
        ((program.mentors ?? []) as any[]).map((mentor) => mentor.documentId),
      );
      const reports = await reportsInProgram(strapi, program.documentId);
      const latestReportByOng = new Map<string, any>();
      for (const report of reports) {
        const ongId = report.ong?.documentId;
        if (!ongId) {
          continue;
        }
        const current = latestReportByOng.get(ongId);
        if (!current || `${report.createdAt}` > `${current.createdAt}`) {
          latestReportByOng.set(ongId, report);
        }
      }
      const ngoMentorRows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
        filters: { program: { documentId: program.documentId } },
        populate: { ong: true, mentors: { populate: { avatar: true } } },
      });
      const mentorsByOng = new Map<string, any[]>();
      for (const row of ngoMentorRows as any[]) {
        const rowOngs = Array.isArray(row.ong) ? row.ong : row.ong ? [row.ong] : [];
        const mentors = ((row.mentors ?? []) as any[])
          .map(mentorView)
          .filter((mentor) => programMentorIds.has(mentor.documentId));
        for (const ongEntry of rowOngs) {
          const previous = mentorsByOng.get(ongEntry.documentId) ?? [];
          const merged = [
            ...previous,
            ...mentors.filter((mentor) => !previous.some((p) => p.documentId === mentor.documentId)),
          ];
          mentorsByOng.set(ongEntry.documentId, merged);
        }
      }
      return {
        data: {
          ongs: ((program.ongs ?? []) as any[]).map((ong) => {
            const report = latestReportByOng.get(ong.documentId);
            return {
              ...ongView(ong),
              evaluation: report
                ? { documentId: report.documentId, name: report.name }
                : null,
              mentors: mentorsByOng.get(ong.documentId) ?? [],
              phaseEvaluations: phaseEvaluationsView(
                program,
                ong.documentId,
                reports,
              ),
            };
          }),
        },
      };
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
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
        data: { mentors: { connect: docRefs(mentorIds) } },
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
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
        data: { mentors: { disconnect: docRefs(mentorIds) } },
      });
      return { message: "Mentorii au fost eliminați din program" };
    },
    async assignOngMentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignOngMentorsSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const { program: programId, ong: ongId, mentors: mentorIdsInput } = parsed.data;
      const program = await strapi.documents("api::program.program").findOne({
        documentId: programId,
        populate: { ongs: true, mentors: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
      }
      const programOngIds = new Set(((program.ongs ?? []) as any[]).map((ong) => ong.documentId));
      if (!programOngIds.has(ongId)) {
        return ctx.badRequest("Organizația nu este alocată acestui program");
      }
      const programMentorIds = new Set(
        ((program.mentors ?? []) as any[]).map((mentor) => mentor.documentId),
      );
      const mentorIds = [...new Set(mentorIdsInput)];
      const outsiderId = mentorIds.find((id) => !programMentorIds.has(id));
      if (outsiderId) {
        const outsider = await strapi
          .documents("plugin::users-permissions.user")
          .findOne({ documentId: outsiderId });
        return ctx.badRequest(
          outsider
            ? `Persoana ${outsider.email} nu este alocată acestui program`
            : "Persoana resursă nu există",
        );
      }
      // A mentor who deleted their account stays in `program.mentors` (BR-34)
      // so their history keeps rendering, which means membership no longer
      // implies availability — they cannot take on a new organization.
      const deletedMentors = await strapi
        .documents("plugin::users-permissions.user")
        .findMany({
          filters: { documentId: { $in: mentorIds }, accountStatus: "deleted" },
        });
      if (deletedMentors.length > 0) {
        return ctx.badRequest(
          "Persoana resursă selectată și-a șters contul și nu mai poate fi alocată",
        );
      }
      const row = await findOrCreateNgoMentorRow(strapi, programId, ongId);
      const updated = await strapi.documents("api::ngo-mentor.ngo-mentor").update({
        documentId: row.documentId,
        data: { mentors: { connect: mentorIds } },
        populate: { mentors: { populate: { avatar: true } } },
      });
      return { data: { mentors: ((updated.mentors ?? []) as any[]).map(mentorView) } };
    },
    async removeOngMentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignOngMentorsSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const { program: programId, ong: ongId, mentors: mentorIdsInput } = parsed.data;
      const program = await strapi.documents("api::program.program").findOne({
        documentId: programId,
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
      }
      const row = await strapi.documents("api::ngo-mentor.ngo-mentor").findFirst({
        filters: {
          program: { documentId: programId },
          ong: { documentId: ongId },
        },
        populate: { mentors: true },
      });
      if (!row) {
        return ctx.badRequest(
          "Nicio persoană resursă nu este alocată acestei organizații în acest program",
        );
      }
      const mentorIds = [...new Set(mentorIdsInput)];
      const assigned = new Set(((row.mentors ?? []) as any[]).map((mentor) => mentor.documentId));
      const outsiderIds = mentorIds.filter((id) => !assigned.has(id));
      if (outsiderIds.length > 0) {
        return ctx.badRequest(
          "Persoana resursă nu este alocată acestei organizații în acest program",
        );
      }
      const updated = await strapi.documents("api::ngo-mentor.ngo-mentor").update({
        documentId: row.documentId,
        data: { mentors: { disconnect: mentorIds } },
        populate: { mentors: { populate: { avatar: true } } },
      });
      return { data: { mentors: ((updated.mentors ?? []) as any[]).map(mentorView) } };
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
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
      const today = todayInBucharest();
      const phaseByOng = new Map<string, any>();
      for (const pick of picks) {
        const ong = ongByDocumentId.get(pick.ong);
        const resolved = resolvePickPhase(
          program,
          pick.phase,
          today,
          ong?.name ?? "",
        );
        if ("error" in resolved) {
          return ctx.badRequest(resolved.error);
        }
        const phase = resolved.phase;
        const report = await strapi.documents("api::report.report").findOne({
          documentId: pick.report,
          populate: { ong: true, phases: { populate: { program: true } } },
        });
        if (!report || report.ong?.documentId !== pick.ong) {
          return ctx.badRequest(
            `Evaluarea nu aparține organizației ${ong?.name}`,
          );
        }
        if (phaseEndedForUnfinishedReport(phase, report, today)) {
          return ctx.badRequest(
            `Faza ${phase.title} s-a încheiat; poți asocia doar evaluări finalizate`,
          );
        }
        const clash = phaseOfSameProgram(report, program.documentId);
        if (clash) {
          return ctx.badRequest(
            `Evaluarea este deja asociată fazei ${clash.title} din acest program`,
          );
        }
        const taken = await findPhaseReport(strapi, phase.documentId, pick.ong);
        if (taken) {
          return ctx.badRequest(
            `Faza ${phase.title} are deja o evaluare pentru organizația ${ong?.name}`,
          );
        }
        phaseByOng.set(pick.ong, phase);
      }
      const updated = await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { ongs: { connect: docRefs(ongIds) } },
        populate: { ongs: true },
      });
      for (const pick of picks) {
        const phase = phaseByOng.get(pick.ong);
        await strapi.documents("api::report.report").update({
          documentId: pick.report,
          data: { phases: { connect: [docRef(phase.documentId)] } },
        });
      }
      let emailSent = true;
      for (const ong of ongs) {
        try {
          const admins = await strapi
            .documents("plugin::users-permissions.user")
            .findMany({
              filters: {
                ongs: { documentId: ong.documentId },
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
        } catch (error) {
          console.error("assignOngs admin lookup failed", error);
          emailSent = false;
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
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
        data: { phases: { connect: [docRef(phase.documentId)] } },
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
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
          phases: { disconnect: [docRef(phase.documentId)] },
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
      const finishedError = programFinishedError(program, todayInBucharest());
      if (finishedError) {
        return ctx.badRequest(finishedError);
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
            phases: { disconnect: docRefs(phaseIds) },
            ...(bornHere ? { originPhase: null } : {}),
          },
        });
      }
      await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { ongs: { disconnect: docRefs(ongIds) } },
      });
      return { message: "Organizațiile au fost eliminate din program" };
    },
  }),
);
