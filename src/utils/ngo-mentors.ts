import { isAnonymized } from "./anonymize";

/**
 * A mentor who deleted their account stays assigned (BR-34) so the
 * organization keeps its history, but is rendered greyed out and inert. The
 * name is already `Anonim <documentId>` (BR-27); `email` is the
 * `deleted-…@anonim.local` placeholder and must never reach the client as if
 * it were an address, so it is nulled here with the other contact fields.
 */
export const mentorView = (mentor: any) => {
  const deleted = isAnonymized(mentor);
  return {
    documentId: mentor.documentId,
    nume: mentor.nume,
    email: deleted ? null : mentor.email,
    mentorJobTitle: deleted ? null : (mentor.mentorJobTitle ?? null),
    mentorOrganization: deleted ? null : (mentor.mentorOrganization ?? null),
    avatar:
      !deleted && mentor.avatar
        ? {
            documentId: mentor.avatar.documentId,
            name: mentor.avatar.name,
            url: mentor.avatar.url,
          }
        : null,
    isDeleted: deleted,
  };
};

/**
 * The persoane resursă assigned to one organization inside one program.
 *
 * Mentors dropped from the program itself stay listed on the `ngo-mentor` row,
 * so the row is intersected with the program's own mentor list — the same rule
 * `program.ongs` applies when it builds the FDSC table.
 */
export async function ngoMentorsFor(
  strapi: any,
  program: any,
  ongDocumentId: string,
) {
  const programMentorIds = new Set(
    ((program.mentors ?? []) as any[]).map((mentor) => mentor.documentId),
  );
  const row = await strapi.documents("api::ngo-mentor.ngo-mentor").findFirst({
    filters: {
      program: { documentId: program.documentId },
      ong: { documentId: ongDocumentId },
    },
    populate: { mentors: { populate: { avatar: true } } },
  });
  return ((row?.mentors ?? []) as any[])
    .map(mentorView)
    .filter((mentor) => programMentorIds.has(mentor.documentId));
}

const asList = (value: any): any[] =>
  Array.isArray(value) ? value : value ? [value] : [];

/**
 * Every assigned mentor of the given organizations, per organization and per
 * program, in a handful of reads rather than one per organization. Like
 * `ngoMentorsFor`, a mentor dropped from the program itself is left out even
 * though the `ngo-mentor` row still lists them. `programDocumentId` narrows the
 * read to one program.
 */
export async function assignedMentorsByOng(
  strapi: any,
  ongDocumentIds: string[],
  programDocumentId?: string,
): Promise<Map<string, Map<string, any[]>>> {
  const byOng = new Map<string, Map<string, Map<string, any>>>();
  if (ongDocumentIds.length > 0) {
    const rows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
      filters: {
        ong: { documentId: { $in: ongDocumentIds } },
        ...(programDocumentId
          ? { program: { documentId: programDocumentId } }
          : {}),
      },
      populate: {
        ong: true,
        program: { populate: { mentors: true } },
        mentors: true,
      },
    });
    for (const row of rows as any[]) {
      for (const program of asList(row.program)) {
        const inProgram = new Set(
          asList(program.mentors).map((mentor) => mentor.documentId),
        );
        for (const ong of asList(row.ong)) {
          const byProgram = byOng.get(ong.documentId) ?? new Map();
          const mentors = byProgram.get(program.documentId) ?? new Map();
          for (const mentor of asList(row.mentors)) {
            if (inProgram.has(mentor.documentId)) {
              mentors.set(mentor.documentId, mentor);
            }
          }
          byProgram.set(program.documentId, mentors);
          byOng.set(ong.documentId, byProgram);
        }
      }
    }
  }
  return new Map(
    [...byOng].map(([ongId, byProgram]) => [
      ongId,
      new Map(
        [...byProgram].map(([programId, mentors]) => [
          programId,
          [...mentors.values()],
        ]),
      ),
    ]),
  );
}

/** One organization's mentors across the given programs (all when omitted), once each. */
export const mentorsAcross = (
  byProgram: Map<string, any[]> | undefined,
  programDocumentIds?: string[],
): any[] => {
  const unique = new Map<string, any>();
  for (const [programId, mentors] of byProgram ?? []) {
    if (programDocumentIds && !programDocumentIds.includes(programId)) continue;
    for (const mentor of mentors) unique.set(mentor.documentId, mentor);
  }
  return [...unique.values()];
};
