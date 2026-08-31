export interface DimensionComment {
  /** Always `null` here — see `collectAnonymousComments`. */
  author: string | null;
  text: string;
}

/**
 * The arguments members wrote while completing an evaluation, grouped by
 * dimension. Attribution is deliberately dropped: this feeds the NGO admin's
 * report page, and the admin is the members' superior — naming them there would
 * undercut the candid answers the questionnaire asks for. Payloads meant for
 * FDSC staff and mentors carry the respondents and their names already, so they
 * build their own attributed view.
 */
export const collectAnonymousComments = (
  evaluations: any[],
): Record<string, DimensionComment[]> => {
  const byDimension: Record<string, DimensionComment[]> = {};
  for (const evaluation of evaluations ?? []) {
    for (const block of evaluation.dimensions ?? []) {
      const text = (block.comment ?? "").trim();
      if (!block.submitted || !text) {
        continue;
      }
      byDimension[block.dimensionKey] ??= [];
      byDimension[block.dimensionKey].push({ author: null, text });
    }
  }
  return byDimension;
};
