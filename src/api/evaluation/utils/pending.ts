import { allPhasesEnded } from "../../report/utils/association";
import { isClosed } from "../../report/utils/lifecycle";
import { todayInBucharest } from "../../../utils/date";
import { computeProgress, EvaluationStatus } from "./progress";

export interface PendingEvaluationRef {
  documentId: string;
  status: EvaluationStatus;
}

/**
 * One evaluation per ong: the newest one this member still owes a response
 * on. Mirrors `evaluation.current`'s notion of "active" (report not
 * finished, phases not all ended) plus the frontend's own
 * `findActiveEvaluation` rule of excluding a round this member has already
 * completed themselves — so a respondent who finished early doesn't see a
 * stale banner while others are still answering.
 */
export const pendingEvaluationsByOng = async (
  strapi: any,
  userDocumentId: string,
): Promise<Map<string, PendingEvaluationRef>> => {
  const evaluations = await strapi
    .documents("api::evaluation.evaluation")
    .findMany({
      filters: {
        user: { documentId: userDocumentId },
        report: { finished: false },
      },
      sort: { createdAt: "desc" },
      populate: {
        dimensions: true,
        report: {
          populate: { ong: true, phases: { populate: { program: true } } },
        },
      },
    });
  const today = todayInBucharest();
  const byOng = new Map<string, PendingEvaluationRef>();
  for (const evaluation of evaluations as any[]) {
    const ongDocumentId = evaluation.report?.ong?.documentId;
    if (!ongDocumentId || byOng.has(ongDocumentId)) continue;
    if (allPhasesEnded(evaluation.report, today)) continue;
    const progress = computeProgress(
      evaluation.dimensions,
      isClosed(evaluation.report, today),
    );
    if (progress.status === "completat") continue;
    byOng.set(ongDocumentId, { documentId: evaluation.documentId, status: progress.status });
  }
  return byOng;
};
