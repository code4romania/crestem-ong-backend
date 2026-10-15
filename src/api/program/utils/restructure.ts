/**
 * The October 2026 program restructure: SCA and BRD HUB START, as the legacy
 * import left them, are replaced by the four programs the client listed in
 * "Centralizare Organizatii in Programe Crestem.ONG.xlsx".
 *
 * Everything here is pure; the controller only reads what it needs and writes
 * what these functions decide. Temporary: removed once it has run in
 * production.
 */

export interface RestructurePhase {
  title: string;
  startDate: string;
  endDate: string;
}

export interface RestructureProgram {
  name: string;
  startDate: string;
  endDate: string;
  phases: RestructurePhase[];
  ongs: { cui: string; name: string }[];
}

export interface SkippedOng {
  program: string;
  name: string;
  cui: string;
  reason: string;
}

/** The client's sheet and the database disagree on the `RO` prefix and spacing. */
export const normalizeCui = (cui: unknown): string =>
  String(cui ?? "")
    .trim()
    .replace(/^RO/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();

/**
 * Matches each listed organization by fiscal code alone; the name in the sheet
 * is only carried into the report. A code that matches nothing, or more than
 * one organization, is skipped rather than guessed.
 */
export const resolveMembers = (
  programs: RestructureProgram[],
  ongs: { documentId: string; cui: string }[],
) => {
  const byCui = new Map<string, string[]>();
  for (const ong of ongs) {
    const cui = normalizeCui(ong.cui);
    if (!cui) continue;
    byCui.set(cui, [...(byCui.get(cui) ?? []), ong.documentId]);
  }

  const members = new Map<string, string[]>();
  const skipped: SkippedOng[] = [];
  for (const program of programs) {
    const ids: string[] = [];
    for (const listed of program.ongs) {
      const matches = byCui.get(normalizeCui(listed.cui)) ?? [];
      if (matches.length !== 1) {
        skipped.push({
          program: program.name,
          name: listed.name,
          cui: listed.cui,
          reason:
            matches.length === 0
              ? "CUI negăsit în DB"
              : `CUI ambiguu: ${matches.length} ONG-uri cu acest CUI`,
        });
        continue;
      }
      if (!ids.includes(matches[0])) ids.push(matches[0]);
    }
    members.set(program.name, ids);
  }
  return { members, skipped };
};

/**
 * The phases a report belongs to: every phase of every program its
 * organization is listed in whose window holds the day the report was
 * created. Overlapping programs both get it.
 */
export const placeReport = (
  report: { ongDocumentId: string; createdDate: string },
  programs: RestructureProgram[],
  members: Map<string, string[]>,
) => {
  const placed: { program: string; phase: string }[] = [];
  for (const program of programs) {
    if (!(members.get(program.name) ?? []).includes(report.ongDocumentId)) {
      continue;
    }
    for (const phase of program.phases) {
      if (
        report.createdDate >= phase.startDate &&
        report.createdDate <= phase.endDate
      ) {
        placed.push({ program: program.name, phase: phase.title });
      }
    }
  }
  return placed;
};

/**
 * A report is moved only if it is independent or sits in one of the programs
 * being replaced. Reports in any other program are not touched.
 */
export const isCandidate = (
  phaseProgramIds: string[],
  oldProgramIds: string[],
) =>
  phaseProgramIds.length === 0 ||
  phaseProgramIds.some((id) => oldProgramIds.includes(id));
