import { describe, expect, it, vi } from "vitest";
import { detachMentorAssignments } from "./mentor-assignments";

function mockStrapi(programs: any[], ngoMentors: any[]) {
  const updates: Array<{ uid: string; documentId: string; data: any }> = [];
  const strapi = {
    documents: (uid: string) => ({
      findMany: vi.fn(async () => (uid === "api::program.program" ? programs : ngoMentors)),
      update: vi.fn(async ({ documentId, data }: any) => {
        updates.push({ uid, documentId, data });
      }),
    }),
  };
  return { strapi, updates };
}

describe("detachMentorAssignments", () => {
  it("removes the mentor from a program and keeps the other mentors", async () => {
    const { strapi, updates } = mockStrapi(
      [{ documentId: "prog1", mentors: [{ documentId: "me" }, { documentId: "other" }] }],
      [],
    );

    await detachMentorAssignments(strapi, "me");

    const programUpdate = updates.find((u) => u.uid === "api::program.program");
    expect(programUpdate?.documentId).toBe("prog1");
    expect(programUpdate?.data.mentors).toEqual([{ documentId: "other" }]);
  });

  it("removes the mentor from an ngo-mentor assignment", async () => {
    const { strapi, updates } = mockStrapi(
      [],
      [{ documentId: "nm1", mentors: [{ documentId: "me" }] }],
    );

    await detachMentorAssignments(strapi, "me");

    const ngoMentorUpdate = updates.find((u) => u.uid === "api::ngo-mentor.ngo-mentor");
    expect(ngoMentorUpdate?.documentId).toBe("nm1");
    expect(ngoMentorUpdate?.data.mentors).toEqual([]);
  });

  it("does not update rows the mentor does not belong to", async () => {
    const { strapi, updates } = mockStrapi(
      [{ documentId: "prog1", mentors: [{ documentId: "someone-else" }] }],
      [],
    );

    await detachMentorAssignments(strapi, "me");

    expect(updates).toHaveLength(0);
  });

  it("tolerates rows with no mentors at all", async () => {
    const { strapi, updates } = mockStrapi([{ documentId: "prog1" }], [{ documentId: "nm1", mentors: null }]);

    await detachMentorAssignments(strapi, "me");

    expect(updates).toHaveLength(0);
  });
});
