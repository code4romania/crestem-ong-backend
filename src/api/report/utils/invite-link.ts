/**
 * The respondent wizard lives under the organization the evaluation belongs to
 * — `app/dashboard/user-ong/[ongDocumentId]/evaluari/[evaluationDocumentId]` in
 * the frontend, whose `user-ong` folder the proxy adds from the session role
 * and never shows in the URL. So the link needs both documentId's; neither
 * segment can be dropped.
 *
 * Only ngo-member respondents are ever mailed one (see `sendInvites`), so there
 * is a single form of this link.
 */
export const buildEvaluationLink = (
  ongDocumentId: string,
  evaluationDocumentId: string,
) => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}/dashboard/${ongDocumentId}/evaluari/${evaluationDocumentId}`;
};
