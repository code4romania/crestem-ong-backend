export const EVALUATION_PATH = "/evaluare";

export const buildEvaluationLink = (evaluationDocumentId: string) => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}${EVALUATION_PATH}/${evaluationDocumentId}`;
};
