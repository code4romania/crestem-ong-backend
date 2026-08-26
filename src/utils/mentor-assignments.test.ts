import { describe, expect, it, vi } from "vitest";
import { detachOngFromMentorAssignments } from "./mentor-assignments";

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
