import { describe, expect, it, vi } from "vitest";
import { pairKey, syncConversationsForOng } from "./sync";

const NGO_MENTOR_UID = "api::ngo-mentor.ngo-mentor";
const CONVERSATION_UID = "api::conversation.conversation";

function mockStrapi(ngoMentorRows: any[], conversations: any[]) {
  const created: any[] = [];
  const strapi = {
    documents: (uid: string) => ({
      findMany: vi.fn(async () =>
        uid === NGO_MENTOR_UID ? ngoMentorRows : conversations,
      ),
      create: vi.fn(async ({ data }: any) => {
        expect(uid).toBe(CONVERSATION_UID);
        created.push(data);
        return data;
      }),
    }),
  };
  return { strapi, created };
}

const ong = { documentId: "ong-1" };

const rowWith = (mentor: any) => ({
  documentId: "nm-1",
  program: [{ documentId: "prog-1" }],
  mentors: [mentor],
});

const activeMentor = { documentId: "m-1", accountStatus: "active" };
const deletedMentor = { documentId: "m-2", accountStatus: "deleted" };

describe("syncConversationsForOng", () => {
  it("creates the missing conversation of an active mentor", async () => {
    const { strapi, created } = mockStrapi([rowWith(activeMentor)], []);

    await syncConversationsForOng(strapi, ong);

    expect(created).toEqual([
      { ong: "ong-1", mentor: "m-1", program: "prog-1" },
    ]);
  });

  // BR-34: the assignment survives the deletion, so the pair stays valid and
  // `list` keeps showing whatever conversation already exists. What must not
  // happen is a fresh, empty thread with somebody who is no longer there.
  it("never opens a new conversation with a deleted mentor", async () => {
    const { strapi, created } = mockStrapi([rowWith(deletedMentor)], []);

    await syncConversationsForOng(strapi, ong);

    expect(created).toEqual([]);
  });

  it("keeps a deleted mentor's pair valid so the existing thread stays listed", async () => {
    const { strapi } = mockStrapi([rowWith(deletedMentor)], [
      {
        documentId: "conv-1",
        mentor: { documentId: "m-2" },
        program: { documentId: "prog-1" },
      },
    ]);

    const pairs = await syncConversationsForOng(strapi, ong);

    expect(pairs.has(pairKey("prog-1", "m-2"))).toBe(true);
  });
});
