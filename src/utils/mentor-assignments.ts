import { docRef } from "./relations";

const PROGRAM_UID = "api::program.program";
const NGO_MENTOR_UID = "api::ngo-mentor.ngo-mentor";

const withoutUser = (entries: any[] | null | undefined, userDocumentId: string) =>
  ((entries ?? []) as any[]).filter((entry) => entry?.documentId !== userDocumentId);

const detachFrom = async (
  strapi: any,
  uid: string,
  userDocumentId: string,
): Promise<void> => {
  const rows: any[] = await strapi.documents(uid).findMany({
    filters: { mentors: { documentId: userDocumentId } },
    populate: { mentors: true },
  });
  for (const row of rows) {
    const current = (row.mentors ?? []) as any[];
    if (!current.some((entry) => entry?.documentId === userDocumentId)) continue;
    await strapi.documents(uid).update({
      documentId: row.documentId,
      data: {
        mentors: withoutUser(current, userDocumentId).map((entry) =>
          docRef(entry.documentId),
        ),
      },
    });
  }
};

/**
 * Ends every mentoring assignment of a deleted account (BR-34).
 *
 * Conversations, meetings and reports are deliberately left alone: their
 * content stays stored at organization level and simply renders as `Anonim`.
 */
export async function detachMentorAssignments(
  strapi: any,
  userDocumentId: string,
): Promise<void> {
  await detachFrom(strapi, PROGRAM_UID, userDocumentId);
  await detachFrom(strapi, NGO_MENTOR_UID, userDocumentId);
}
