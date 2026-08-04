import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { assignMentorsSchema } from "../validation/assign-mentors";
import { assignOngsSchema } from "../validation/assign-ongs";
import {
  createProgramSchema,
  updateProgramSchema,
  phasesOutsideProgram,
} from "../validation/program";
import { EmailService } from "../../email/services/email";

const mentorView = (mentor: any) => ({
  documentId: mentor.documentId,
  nume: mentor.nume,
  email: mentor.email,
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
        const duplicate = await strapi.db.query("api::program.program").findOne({
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
      const { phases, ...programData } = parsed.data;
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
        const keptIds = new Set(
          phases.map((phase) => phase.documentId).filter(Boolean),
        );
        removedPhases = existingPhases.filter(
          (phase) => !keptIds.has(phase.documentId),
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
        populate: { reports: true, phases: true },
      });
      if (!existing) {
        return ctx.badRequest("Programul nu există");
      }
      if (((existing.reports ?? []) as any[]).length > 0) {
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
      return { data: { documentId: existing.documentId } };
    },
    async mentors(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: ctx.params.documentId,
        populate: { mentors: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      return { data: { mentors: (program.mentors ?? []).map(mentorView) } };
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
      return { data: { ongs: (program.ongs ?? []).map(ongView) } };
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
        populate: { mentors: true },
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
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const mentorIds = [...new Set(parsed.data.mentors)];
      const updated = await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { mentors: { disconnect: mentorIds } },
        populate: { mentors: true },
      });
      return { data: { mentors: (updated.mentors ?? []).map(mentorView) } };
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
        populate: { ongs: true },
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const ongIds = [...new Set(parsed.data.ongs)];
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
      const updated = await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { ongs: { connect: ongIds } },
        populate: { ongs: true },
      });
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
    async removeOngs(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const parsed = assignOngsSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const program = await strapi.documents("api::program.program").findOne({
        documentId: parsed.data.program,
      });
      if (!program) {
        return ctx.badRequest("Programul nu există");
      }
      const ongIds = [...new Set(parsed.data.ongs)];
      const updated = await strapi.documents("api::program.program").update({
        documentId: program.documentId,
        data: { ongs: { disconnect: ongIds } },
        populate: { ongs: true },
      });
      return { data: { ongs: (updated.ongs ?? []).map(ongView) } };
    },
  }),
);
