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
  // The answers come from `attachDimensions`, not from a populate.
  evaluations: { populate: { user: true } },
} as const;

/**
 * Sets each evaluation's `dimensions` (with `quiz`), shaped as the populate
 * would, read straight from the component tables. A full export reads well
 * over 100,000 answers, and Strapi turns each component row into a whole
 * entity: that alone took most of the export's time. These are the columns
 * the scores and the arguments read.
 */
export async function attachDimensions(strapi: any, evaluations: any[]): Promise<void> {
  if (evaluations.length === 0) return;
  const knex = strapi.db.connection;

  const blocks = (await knex("evaluations_cmps as link")
    .join("components_evaluation_dimensions as block", "block.id", "link.cmp_id")
    .whereIn("link.entity_id", evaluations.map((evaluation) => evaluation.id))
    .where({ "link.field": "dimensions", "link.component_type": "evaluation.dimension" })
    .orderBy(["link.entity_id", "link.order"])
    .select(
      "link.entity_id as evaluationId",
      "block.id",
      "block.dimension_key as dimensionKey",
      "block.comment",
      "block.submitted",
    )) as any[];

  const answers = blocks.length
    ? ((await knex("components_evaluation_dimensions_cmps as link")
        .join("components_evaluation_questions as question", "question.id", "link.cmp_id")
        .whereIn("link.entity_id", blocks.map((block) => block.id))
        .where({ "link.field": "quiz", "link.component_type": "evaluation.question" })
        .orderBy(["link.entity_id", "link.order"])
        .select(
          "link.entity_id as blockId",
          "question.question_id as questionId",
          "question.answer",
        )) as any[])
    : [];

  const quizByBlock = new Map<number, any[]>();
  for (const { blockId, ...answer } of answers) {
    const quiz = quizByBlock.get(blockId) ?? [];
    quiz.push(answer);
    quizByBlock.set(blockId, quiz);
  }
  const dimensionsByEvaluation = new Map<number, any[]>();
  for (const { evaluationId, ...block } of blocks) {
    const dimensions = dimensionsByEvaluation.get(evaluationId) ?? [];
    dimensions.push({ ...block, quiz: quizByBlock.get(block.id) ?? [] });
    dimensionsByEvaluation.set(evaluationId, dimensions);
  }
  for (const evaluation of evaluations) {
    evaluation.dimensions = dimensionsByEvaluation.get(evaluation.id) ?? [];
  }
}

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
      attachDimensions(
        strapi,
        reports.flatMap((report) => report.evaluations ?? []),
      ),
    ]);
    for (const report of inOrder(batch, reports)) {
      visit(report, { admins, mentors, enrollments, today });
    }
  }
}
