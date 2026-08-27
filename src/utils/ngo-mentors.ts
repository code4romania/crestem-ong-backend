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
