import { docRef } from "./relations";

const NGO_MENTOR_UID = "api::ngo-mentor.ngo-mentor";

const withoutOng = (entries: any[] | null | undefined, ongDocumentId: string) =>
  ((entries ?? []) as any[]).filter((entry) => entry?.documentId !== ongDocumentId);

/**
 * Ends every mentoring assignment of a deleted organization (BR-33).
 *
 * There is no mirror image on the account side: a mentor who deletes their own
 * account (BR-34) keeps their `program.mentors` and `ngo-mentor.mentors` rows,
 * so the organization still sees the conversation, meetings and reports of the
 * person who worked with it — anonymized and read-only. Only the organization
 * side detaches, because a deleted organization has nobody left to read them.
 *
 * Without this the (ong, program, mentor) pair stays valid in
 * `conversation/utils/sync`, so the mentor keeps seeing the deleted
 * organization's conversation in their list after `Șterge ONG`. The mentor's
 * own account is untouched; conversations, meetings and reports stay stored
 * against the anonymized organization.
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
