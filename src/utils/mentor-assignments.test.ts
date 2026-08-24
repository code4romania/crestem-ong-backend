import { describe, expect, it, vi } from "vitest";
import {
  detachMentorAssignments,
  detachOngFromMentorAssignments,
} from "./mentor-assignments";

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

function mockOngStrapi(ngoMentors: any[]) {
  const updates: Array<{ documentId: string; data: any }> = [];
  const queries: any[] = [];
  const strapi = {
    documents: (uid: string) => ({
      findMany: vi.fn(async (params: any) => {
        queries.push({ uid, params });
        return uid === "api::ngo-mentor.ngo-mentor" ? ngoMentors : [];
      }),
      update: vi.fn(async ({ documentId, data }: any) => {
        updates.push({ documentId, data });
      }),
    }),
  };
  return { strapi, updates, queries };
}

describe("detachOngFromMentorAssignments", () => {
  it("queries only the ngo-mentor rows of this organization", async () => {
    const { strapi, queries } = mockOngStrapi([]);

    await detachOngFromMentorAssignments(strapi, "ong-1");

    expect(queries).toEqual([
      {
        uid: "api::ngo-mentor.ngo-mentor",
        params: { filters: { ong: { documentId: "ong-1" } }, populate: { ong: true } },
      },
    ]);
  });

  it("removes the organization and keeps every other one on the row", async () => {
    const { strapi, updates } = mockOngStrapi([
      { documentId: "nm1", ong: [{ documentId: "ong-1" }, { documentId: "ong-2" }] },
    ]);

    await detachOngFromMentorAssignments(strapi, "ong-1");

    expect(updates).toEqual([
      { documentId: "nm1", data: { ong: [{ documentId: "ong-2" }] } },
    ]);
  });

  it("accepts a populated `ong` that came back as a single object", async () => {
    const { strapi, updates } = mockOngStrapi([
      { documentId: "nm1", ong: { documentId: "ong-1" } },
    ]);

    await detachOngFromMentorAssignments(strapi, "ong-1");

    expect(updates).toEqual([{ documentId: "nm1", data: { ong: [] } }]);
  });

  it("does not update rows the organization does not belong to", async () => {
    const { strapi, updates } = mockOngStrapi([
      { documentId: "nm1", ong: [{ documentId: "ong-9" }] },
      { documentId: "nm2", ong: null },
    ]);

    await detachOngFromMentorAssignments(strapi, "ong-1");

    expect(updates).toHaveLength(0);
  });
});
