export const mentorView = (mentor: any) => ({
  documentId: mentor.documentId,
  nume: mentor.nume,
  email: mentor.email,
  mentorJobTitle: mentor.mentorJobTitle ?? null,
  mentorOrganization: mentor.mentorOrganization ?? null,
  avatar: mentor.avatar
    ? {
        documentId: mentor.avatar.documentId,
        name: mentor.avatar.name,
        url: mentor.avatar.url,
      }
    : null,
});

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
