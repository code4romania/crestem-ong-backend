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

const withoutOng = (entries: any[] | null | undefined, ongDocumentId: string) =>
  ((entries ?? []) as any[]).filter((entry) => entry?.documentId !== ongDocumentId);

/**
 * Ends every mentoring assignment of a deleted organization (BR-33).
 *
 * The mirror image of `detachMentorAssignments`, from the ONG side. Without it
 * the (ong, program, mentor) pair stays valid in `conversation/utils/sync`, so
 * the mentor keeps seeing the deleted organization's conversation in their list
 * after `Șterge ONG`. The mentor's own account is untouched; conversations,
 * meetings and reports stay stored against the anonymized organization.
 *
 * What this detach does *not* do is close the conversation. `listForMentor`
 * filters on the pair and so drops it from the list, but
 * `sendMessageForMentor` only checks that `conversation.mentor` is the caller —
 * it never re-checks the assignment — so a direct POST with a conversation id
 * the mentor already knows still succeeds. Pre-existing platform behaviour,
 * recorded here rather than fixed.
 */
export async function detachOngFromMentorAssignments(
  strapi: any,
  ongDocumentId: string,
): Promise<void> {
  const rows: any[] = await strapi.documents(NGO_MENTOR_UID).findMany({
    filters: { ong: { documentId: ongDocumentId } },
    populate: { ong: true },
  });
  for (const row of rows) {
    const current = (Array.isArray(row.ong) ? row.ong : row.ong ? [row.ong] : []) as any[];
    if (!current.some((entry) => entry?.documentId === ongDocumentId)) continue;
    await strapi.documents(NGO_MENTOR_UID).update({
      documentId: row.documentId,
      data: {
        ong: withoutOng(current, ongDocumentId).map((entry) =>
          docRef(entry.documentId),
        ),
      },
    });
  }
}
