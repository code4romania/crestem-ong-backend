import { getOngAdmins } from "../../../utils/ong-scope";
import { assignedMentorsByOng } from "../../../utils/ngo-mentors";
import { enrollmentDates } from "../../../utils/program-enrollments";
import { inOrder } from "../../evaluation/utils/admin-list";
import type { RoundsExportContext } from "./rounds-export";

/** Rounds read with their answers at a time by the exports, to keep memory flat. */
const EXPORT_BATCH_SIZE = 50;

/** What a row of the rounds exports reads, on top of the round itself. */
const ROUNDS_EXPORT_POPULATE = {
  ong: {
    populate: {
      judet: true,
      localitate: true,
      domeniuPrincipal: true,
      domeniuSecundar: true,
    },
  },
  phases: { populate: { program: true } },
  evaluations: {
    populate: {
      dimensions: { populate: { quiz: true } },
      user: true,
    },
  },
} as const;

/**
 * Reads the given rounds with everything an export row needs, a batch at a
 * time so memory stays flat however many there are, and hands each to `visit`
 * in `ids` order with the context its row is built from.
 */
export async function forEachExportRound(
  strapi: any,
  ids: string[],
  today: string,
  visit: (report: any, context: RoundsExportContext) => void,
): Promise<void> {
  for (let start = 0; start < ids.length; start += EXPORT_BATCH_SIZE) {
    const batch = ids.slice(start, start + EXPORT_BATCH_SIZE);
    const reports = (await strapi.documents("api::report.report").findMany({
      filters: { documentId: { $in: batch } },
      populate: ROUNDS_EXPORT_POPULATE,
    })) as any[];
    const ongIds = [
      ...new Set(reports.map((report) => report.ong?.documentId).filter(Boolean)),
    ] as string[];
    const [admins, mentors, enrollments] = await Promise.all([
      getOngAdmins(strapi, ongIds),
      assignedMentorsByOng(strapi, ongIds),
      enrollmentDates(strapi, ongIds),
    ]);
    for (const report of inOrder(batch, reports)) {
      visit(report, { admins, mentors, enrollments, today });
    }
  }
}
