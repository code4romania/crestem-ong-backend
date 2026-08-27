import { isAnonymized } from "../../../utils/anonymize";

const collectOngEntries = (row: any) =>
  Array.isArray(row.ong) ? row.ong : row.ong ? [row.ong] : [];

const toArray = (value: any) => (Array.isArray(value) ? value : value ? [value] : []);

/**
 * Each ngo-mentor row is created scoped to exactly one (ong, program) pair
 * (see `findOrCreateNgoMentorRow` in the program controller) even though the
 * relation is declared `oneToMany` on the schema, so a populated `program`
 * comes back as a one-element array.
 */
const singleProgramId = (row: any): string | undefined => toArray(row.program)[0]?.documentId;

export const pairKey = (programDocumentId: string, otherDocumentId: string) =>
  `${programDocumentId}:${otherDocumentId}`;

type OngMentorPair = {
  programDocumentId: string;
  mentorDocumentId: string;
  /**
   * A mentor who deleted their account keeps the assignment (BR-34), so the
   * pair stays valid and the existing conversation keeps showing — greyed out
   * and read-only. What must not happen is a *new*, empty conversation being
   * conjured for someone who left before ever writing.
   */
  mentorDeleted: boolean;
};
type OngProgramPair = { programDocumentId: string; ongDocumentId: string };

const getValidPairsForOng = async (
  strapi: any,
  ongDocumentId: string,
): Promise<Map<string, OngMentorPair>> => {
  const ngoMentorRows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
    filters: { ong: { documentId: ongDocumentId } },
    populate: { mentors: true, program: true },
  });

  const pairs = new Map<string, OngMentorPair>();
  for (const row of ngoMentorRows as any[]) {
    const programDocumentId = singleProgramId(row);
    if (!programDocumentId) continue;
    for (const mentor of toArray(row.mentors)) {
      if (!mentor?.documentId) continue;
      pairs.set(pairKey(programDocumentId, mentor.documentId), {
        programDocumentId,
        mentorDocumentId: mentor.documentId,
        mentorDeleted: isAnonymized(mentor),
      });
    }
  }
  return pairs;
};

const getValidPairsForMentor = async (
  strapi: any,
  mentorDocumentId: string,
): Promise<Map<string, OngProgramPair>> => {
  const ngoMentorRows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
    filters: { mentors: { documentId: mentorDocumentId } },
    populate: { ong: true, program: true },
  });

  const pairs = new Map<string, OngProgramPair>();
  for (const row of ngoMentorRows as any[]) {
    const programDocumentId = singleProgramId(row);
    if (!programDocumentId) continue;
    for (const ongEntry of collectOngEntries(row)) {
      if (!ongEntry?.documentId) continue;
      pairs.set(pairKey(programDocumentId, ongEntry.documentId), {
        programDocumentId,
        ongDocumentId: ongEntry.documentId,
      });
    }
  }
  return pairs;
};

/**
 * Creates any missing Conversation rows for (mentor, program) pairs
 * currently assigned to this ong via the ngo-mentor pivot — one conversation
 * per program a mentor is paired with this ong through, even if the same
 * mentor is paired with it across several programs. Returns the valid pair
 * map (keyed by `pairKey(programId, mentorId)`) so the caller can filter out
 * Conversation rows that no longer match (e.g. an unassigned pairing, or a
 * pre-existing conversation predating the program scoping).
 */
export const syncConversationsForOng = async (strapi: any, ong: any) => {
  const pairs = await getValidPairsForOng(strapi, ong.documentId);

  if (pairs.size === 0) {
    return pairs;
  }

  const existing = await strapi.documents("api::conversation.conversation").findMany({
    filters: { ong: { documentId: ong.documentId } },
    populate: { mentor: true, program: true },
  });
  const existingKeys = new Set(
    (existing as any[])
      .map((conversation) => {
        const programId = conversation.program?.documentId;
        const mentorId = conversation.mentor?.documentId;
        return programId && mentorId ? pairKey(programId, mentorId) : null;
      })
      .filter(Boolean),
  );

  for (const [key, pair] of pairs) {
    if (existingKeys.has(key) || pair.mentorDeleted) {
      continue;
    }
    await strapi.documents("api::conversation.conversation").create({
      data: {
        ong: ong.documentId,
        mentor: pair.mentorDocumentId,
        program: pair.programDocumentId,
      },
    });
  }

  return pairs;
};

/**
 * Mirrors `syncConversationsForOng` for the mentor side: creates any missing
 * Conversation rows for (ong, program) pairs currently assigned to this
 * mentor via the ngo-mentor pivot, and returns the valid pair map for
 * filtering.
 */
export const syncConversationsForMentor = async (strapi: any, mentor: any) => {
  const pairs = await getValidPairsForMentor(strapi, mentor.documentId);

  if (pairs.size === 0) {
    return pairs;
  }

  const existing = await strapi.documents("api::conversation.conversation").findMany({
    filters: { mentor: { documentId: mentor.documentId } },
    populate: { ong: true, program: true },
  });
  const existingKeys = new Set(
    (existing as any[])
      .map((conversation) => {
        const programId = conversation.program?.documentId;
        const ongId = conversation.ong?.documentId;
        return programId && ongId ? pairKey(programId, ongId) : null;
      })
      .filter(Boolean),
  );

  for (const [key, pair] of pairs) {
    if (existingKeys.has(key)) {
      continue;
    }
    await strapi.documents("api::conversation.conversation").create({
      data: {
        ong: pair.ongDocumentId,
        mentor: mentor.documentId,
        program: pair.programDocumentId,
      },
    });
  }

  return pairs;
};
