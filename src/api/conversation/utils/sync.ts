export const syncConversationsForOng = async (strapi: any, ong: any) => {
  const programs = await strapi.documents("api::program.program").findMany({
    filters: { ongs: { documentId: ong.documentId } },
    populate: { mentors: true },
  });

  const mentorIds = new Set<string>();
  for (const program of programs as any[]) {
    for (const mentor of (program.mentors ?? []) as any[]) {
      mentorIds.add(mentor.documentId);
    }
  }

  if (mentorIds.size === 0) {
    return;
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
};
