/**
 * When each organization joined a program ("Dată intrare program"). Membership
 * itself is `program.ongs`; this collection only dates it, so nothing that reads
 * membership changes. Organizations added before it existed have no row and
 * show no date.
 *
 * A deleted organization keeps its enrollment like it keeps its membership
 * (BR-33), so nothing here runs on `Șterge ONG`.
 */

const UID = "api::program-enrollment.program-enrollment";

export const enrollmentKey = (ongDocumentId: string, programDocumentId: string) =>
  `${ongDocumentId}:${programDocumentId}`;

/** Dates the organizations just added to a program. */
export async function recordEnrollments(
  strapi: any,
  programDocumentId: string,
  ongDocumentIds: string[],
  joinedAt: Date = new Date(),
): Promise<void> {
  for (const ongDocumentId of ongDocumentIds) {
    await strapi.documents(UID).create({
      data: {
        ong: { connect: [ongDocumentId] },
        program: { connect: [programDocumentId] },
        joinedAt: joinedAt.toISOString(),
      },
    });
  }
}

/** Drops the dates of organizations taken out of a program; re-adding dates them anew. */
export async function removeEnrollments(
  strapi: any,
  programDocumentId: string,
  ongDocumentIds: string[],
): Promise<void> {
  if (ongDocumentIds.length === 0) return;
  const rows = await strapi.documents(UID).findMany({
    filters: {
      program: { documentId: programDocumentId },
      ong: { documentId: { $in: ongDocumentIds } },
    },
  });
  for (const row of rows as any[]) {
    await strapi.documents(UID).delete({ documentId: row.documentId });
  }
}

/** `joinedAt` per `enrollmentKey(ong, program)`, for the given organizations. */
export async function enrollmentDates(
  strapi: any,
  ongDocumentIds: string[],
): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  if (ongDocumentIds.length === 0) return dates;
  const rows = await strapi.documents(UID).findMany({
    filters: { ong: { documentId: { $in: ongDocumentIds } } },
    populate: { ong: { fields: ["documentId"] }, program: { fields: ["documentId"] } },
  });
  for (const row of rows as any[]) {
    const ongId = row.ong?.documentId;
    const programId = row.program?.documentId;
    if (!ongId || !programId) continue;
    const key = enrollmentKey(ongId, programId);
    // Should there ever be two, the earlier one is when the organization joined.
    const current = dates.get(key);
    if (!current || row.joinedAt < current) {
      dates.set(key, row.joinedAt);
    }
  }
  return dates;
}
