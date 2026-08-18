const collectOngEntries = (row: any) =>
  Array.isArray(row.ong) ? row.ong : row.ong ? [row.ong] : [];

const getValidMentorIdsForOng = async (strapi: any, ongDocumentId: string) => {
  const ngoMentorRows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
    filters: { ong: { documentId: ongDocumentId } },
    populate: { mentors: true },
  });

  const mentorIds = new Set<string>();
  for (const row of ngoMentorRows as any[]) {
    for (const mentor of (row.mentors ?? []) as any[]) {
      mentorIds.add(mentor.documentId);
    }
  }
  return mentorIds;
};

const getValidOngIdsForMentor = async (strapi: any, mentorDocumentId: string) => {
  const ngoMentorRows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
    filters: { mentors: { documentId: mentorDocumentId } },
    populate: { ong: true },
  });

  const ongIds = new Set<string>();
  for (const row of ngoMentorRows as any[]) {
    for (const ongEntry of collectOngEntries(row)) {
      ongIds.add(ongEntry.documentId);
    }
  }
  return ongIds;
};

/**
 * Creates any missing Conversation rows for mentors currently assigned to
 * this ong via the ngo-mentor pivot, and returns that same valid-mentor-id
 * set so the caller can filter out Conversation rows that no longer match
 * (e.g. a mentor previously assigned, since unassigned).
 */
export const syncConversationsForOng = async (strapi: any, ong: any) => {
  const mentorIds = await getValidMentorIdsForOng(strapi, ong.documentId);

  if (mentorIds.size === 0) {
    return mentorIds;
  }

  const existing = await strapi.documents("api::conversation.conversation").findMany({
    filters: { ong: { documentId: ong.documentId } },
    populate: { mentor: true },
  });
  const existingMentorIds = new Set(
    (existing as any[]).map((conversation) => conversation.mentor?.documentId).filter(Boolean),
  );

  for (const mentorId of mentorIds) {
    if (existingMentorIds.has(mentorId)) {
      continue;
    }
    await strapi.documents("api::conversation.conversation").create({
      data: { ong: ong.documentId, mentor: mentorId },
    });
  }

  return mentorIds;
};

/**
 * Mirrors `syncConversationsForOng` for the mentor side: creates any
 * missing Conversation rows for ongs currently assigned to this mentor via
 * the ngo-mentor pivot, and returns the valid-ong-id set for filtering.
 */
export const syncConversationsForMentor = async (strapi: any, mentor: any) => {
  const ongIds = await getValidOngIdsForMentor(strapi, mentor.documentId);

  if (ongIds.size === 0) {
    return ongIds;
  }

  const existing = await strapi.documents("api::conversation.conversation").findMany({
    filters: { mentor: { documentId: mentor.documentId } },
    populate: { ong: true },
  });
  const existingOngIds = new Set(
    (existing as any[]).map((conversation) => conversation.ong?.documentId).filter(Boolean),
  );

  for (const ongId of ongIds) {
    if (existingOngIds.has(ongId)) {
      continue;
    }
    await strapi.documents("api::conversation.conversation").create({
      data: { ong: ongId, mentor: mentor.documentId },
    });
  }

  return ongIds;
};
