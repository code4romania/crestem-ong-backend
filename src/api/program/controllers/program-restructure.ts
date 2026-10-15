import { Context } from "koa";
import { z } from "zod";
import restructureData from "../data/restructure-2026-10.json";
import {
  isCandidate,
  placeReport,
  resolveMembers,
  type RestructureProgram,
} from "../utils/restructure";
import { docRef, docRefs } from "../../../utils/relations";
import { toDateString } from "../../../utils/date";

const PROGRAMS = restructureData as RestructureProgram[];

const restructureSchema = z.object({
  dryRun: z.boolean().default(true),
  oldPrograms: z
    .array(z.string().min(1, "Program invalid"))
    .min(1, "Programele vechi sunt obligatorii"),
});

/** Carries the full result out of the transaction so it rolls back. */
class DryRunRollback extends Error {
  constructor(readonly result: any) {
    super("dry-run");
  }
}

/** A precondition that stops the run before anything is written. */
class Refusal extends Error {}

const phaseKey = (program: string, title: string) => `${program}|${title}`;

const REPORT_POPULATE = {
  ong: { fields: ["name", "cui"] },
  phases: { populate: { program: { fields: ["name"] } } },
  originPhase: { populate: { program: { fields: ["name"] } } },
} as const;

async function restructure(oldProgramIds: string[]) {
  const newNames = PROGRAMS.map((program) => program.name);

  // 1. The programs being replaced. Ones already gone are a rerun, not an error.
  const oldPrograms = (await strapi.documents("api::program.program").findMany({
    filters: { documentId: { $in: oldProgramIds } },
    populate: { phases: true, mentors: true },
  })) as any[];
  const clash = oldPrograms.find((program) => newNames.includes(program.name));
  if (clash) {
    throw new Refusal(
      `Programul ${clash.name} este unul dintre programele noi și nu poate fi înlocuit`,
    );
  }
  const oldIds = oldPrograms.map((program) => program.documentId);
  const oldNameById = new Map(
    oldPrograms.map((program) => [program.documentId, program.name]),
  );
  const alreadyRemoved = oldProgramIds.filter((id) => !oldIds.includes(id));

  // Nothing but the phases and the memberships may hang off them: anything
  // else would be left pointing at a deleted program.
  if (oldIds.length > 0) {
    const scope = { program: { documentId: { $in: oldIds } } };
    const [meetings, conversations, ngoMentors] = await Promise.all([
      strapi.documents("api::meeting.meeting").count({ filters: scope }),
      strapi
        .documents("api::conversation.conversation")
        .count({ filters: scope }),
      strapi.documents("api::ngo-mentor.ngo-mentor").count({ filters: scope }),
    ]);
    const mentors = oldPrograms.reduce(
      (total, program) => total + (program.mentors ?? []).length,
      0,
    );
    if (meetings + conversations + ngoMentors + mentors > 0) {
      throw new Refusal(
        `Programele vechi au legături care s-ar pierde: ${mentors} mentori, ` +
          `${ngoMentors} mentori ONG, ${meetings} întâlniri, ${conversations} conversații`,
      );
    }
  }

  // 2. Who goes where, by fiscal code.
  const ongs = (await strapi.documents("api::ong.ong").findMany({
    fields: ["cui"],
  })) as any[];
  const { members, skipped } = resolveMembers(PROGRAMS, ongs);

  // 3. The new programs and their phases, created or brought in line.
  const phaseIdByKey = new Map<string, string>();
  const phaseStartById = new Map<string, string>();
  const newProgramIds: string[] = [];
  const programsOut: any[] = [];
  for (const program of PROGRAMS) {
    const ongIds = members.get(program.name) ?? [];
    const existing = (await strapi.documents("api::program.program").findFirst({
      filters: { name: { $eq: program.name } },
      populate: { phases: true, ongs: { fields: ["name"] } },
    })) as any;
    let documentId: string;
    let previousOngs = 0;
    if (existing) {
      documentId = existing.documentId;
      previousOngs = (existing.ongs ?? []).length;
      await strapi.documents("api::program.program").update({
        documentId,
        data: {
          startDate: program.startDate,
          endDate: program.endDate,
          ongs: { set: docRefs(ongIds) },
        } as any,
      });
    } else {
      const created = await strapi.documents("api::program.program").create({
        data: {
          name: program.name,
          startDate: program.startDate,
          endDate: program.endDate,
          ongs: { connect: docRefs(ongIds) },
        } as any,
      });
      documentId = created.documentId;
    }
    newProgramIds.push(documentId);

    const phasesOut: any[] = [];
    for (const phase of program.phases) {
      const found = ((existing?.phases ?? []) as any[]).find(
        (entry) => entry.title === phase.title,
      );
      const data = {
        title: phase.title,
        startDate: phase.startDate,
        endDate: phase.endDate,
        hasEvaluation: true,
      };
      const saved = found
        ? await strapi
            .documents("api::phase.phase")
            .update({ documentId: found.documentId, data })
        : await strapi.documents("api::phase.phase").create({
            data: { ...data, program: docRef(documentId) } as any,
          });
      phaseIdByKey.set(phaseKey(program.name, phase.title), saved.documentId);
      phaseStartById.set(saved.documentId, phase.startDate);
      phasesOut.push({ ...data, documentId: saved.documentId, created: !found });
    }
    programsOut.push({
      name: program.name,
      documentId,
      created: !existing,
      listed: program.ongs.length,
      ongs: ongIds.length,
      previousOngs,
      phases: phasesOut,
    });
  }

  // 4. Reports: independent ones of the listed organizations, and every report
  // in the programs being replaced.
  const memberIds = [...new Set([...members.values()].flat())];
  const [ofMembers, inOld] = await Promise.all([
    memberIds.length > 0
      ? strapi.documents("api::report.report").findMany({
          filters: { ong: { documentId: { $in: memberIds } } },
          populate: REPORT_POPULATE as any,
        })
      : [],
    oldIds.length > 0
      ? strapi.documents("api::report.report").findMany({
          filters: { phases: { program: { documentId: { $in: oldIds } } } },
          populate: REPORT_POPULATE as any,
        })
      : [],
  ]);
  const reports = new Map<string, any>();
  for (const report of [...ofMembers, ...inOld] as any[]) {
    reports.set(report.documentId, report);
  }

  const replaced = new Set([...oldIds, ...newProgramIds]);
  const attached: any[] = [];
  const independent: any[] = [];
  let updatedReports = 0;
  for (const report of reports.values()) {
    const phases = (report.phases ?? []) as any[];
    const programIds = phases
      .map((phase) => phase.program?.documentId)
      .filter(Boolean);
    if (!isCandidate(programIds, oldIds)) continue;

    const createdDate = toDateString(new Date(report.createdAt));
    const placed = report.ong
      ? placeReport(
          { ongDocumentId: report.ong.documentId, createdDate },
          PROGRAMS,
          members,
        )
      : [];
    const placedIds = placed.map((entry) =>
      phaseIdByKey.get(phaseKey(entry.program, entry.phase)),
    );
    const kept = phases
      .filter((phase) => !replaced.has(phase.program?.documentId))
      .map((phase) => phase.documentId);
    const finalIds = [...new Set([...kept, ...placedIds])];

    // The phase it was started from: the earliest new one when it came from a
    // replaced program or had none, otherwise left as it was.
    const origin = report.originPhase;
    let originId: string | null = origin?.documentId ?? null;
    if (!origin || replaced.has(origin.program?.documentId)) {
      originId =
        [...placedIds].sort((a, b) =>
          phaseStartById.get(a).localeCompare(phaseStartById.get(b)),
        )[0] ?? null;
    }

    const currentIds = phases.map((phase) => phase.documentId);
    const unchanged =
      currentIds.length === finalIds.length &&
      finalIds.every((id) => currentIds.includes(id)) &&
      (origin?.documentId ?? null) === originId;
    if (!unchanged) {
      await strapi.documents("api::report.report").update({
        documentId: report.documentId,
        data: {
          phases: { set: docRefs(finalIds) },
          originPhase: originId ? docRef(originId) : null,
        } as any,
      });
      updatedReports += 1;
    }

    const row = {
      documentId: report.documentId,
      ong: report.ong?.name ?? null,
      cui: report.ong?.cui ?? null,
      createdDate,
    };
    if (placed.length > 0) {
      attached.push({
        ...row,
        phases: placed.map((entry) => `${entry.program} / ${entry.phase}`),
      });
    }
    const fromOld = [
      ...new Set(
        programIds
          .filter((id) => oldIds.includes(id))
          .map((id) => oldNameById.get(id)),
      ),
    ];
    if (finalIds.length === 0 && fromOld.length > 0) {
      independent.push({ ...row, fromPrograms: fromOld });
    }
  }

  // 5. The replaced programs go, phases first: deleting a program leaves them.
  const deleted: string[] = [];
  for (const program of oldPrograms) {
    for (const phase of (program.phases ?? []) as any[]) {
      await strapi
        .documents("api::phase.phase")
        .delete({ documentId: phase.documentId });
    }
    await strapi
      .documents("api::program.program")
      .delete({ documentId: program.documentId });
    deleted.push(program.name);
  }

  return {
    summary: {
      deletedPrograms: deleted,
      alreadyRemoved,
      programs: programsOut.map((program) => ({
        name: program.name,
        listed: program.listed,
        ongs: program.ongs,
      })),
      skippedOngs: skipped.length,
      reportsUpdated: updatedReports,
      reportsAttached: attached.length,
      reportsIndependent: independent.length,
    },
    programs: programsOut,
    skipped,
    attached,
    independent,
  };
}

/**
 * Temporary: one-off restructure of SCA and BRD HUB START (October 2026).
 * Remove together with its route, data file and permission once it has run
 * in production.
 */
export default {
  async run(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const parsed = restructureSchema.safeParse(ctx.request.body ?? {});
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const { dryRun, oldPrograms } = parsed.data;
    try {
      const result = await strapi.db.transaction(async () => {
        const outcome = await restructure([...new Set(oldPrograms)]);
        if (dryRun) {
          throw new DryRunRollback(outcome);
        }
        return outcome;
      });
      console.log("program restructure applied", result.summary);
      return { dryRun: false, ...result };
    } catch (error) {
      if (error instanceof DryRunRollback) {
        return { dryRun: true, ...error.result };
      }
      if (error instanceof Refusal) {
        return ctx.badRequest(error.message);
      }
      console.error("program restructure failed", error);
      return ctx.badRequest(
        "A apărut o eroare neașteptată. Te rugăm să încerci din nou mai târziu.",
      );
    }
  },
};
