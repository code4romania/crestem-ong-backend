import { describe, expect, it } from "vitest";
import { resolveProgramsByMentor } from "./admin-user";

describe("resolveProgramsByMentor", () => {
  it("groups the ongs assigned to a mentor under each program", async () => {
    const rows = [
      {
        program: { documentId: "prog-1", name: "Program A" },
        ong: { documentId: "ong-1", name: "ONG Unu" },
        mentors: [{ documentId: "mentor-1" }],
      },
      {
        program: { documentId: "prog-1", name: "Program A" },
        ong: { documentId: "ong-2", name: "ONG Doi" },
        mentors: [{ documentId: "mentor-1" }],
      },
    ];

    (globalThis as any).strapi = {
      documents: () => ({
        findMany: async () => rows,
      }),
    };

    const result = await resolveProgramsByMentor(["mentor-1"]);

    expect(result.get("mentor-1")).toEqual([
      {
        documentId: "prog-1",
        name: "Program A",
        ongs: [
          { documentId: "ong-1", name: "ONG Unu" },
          { documentId: "ong-2", name: "ONG Doi" },
        ],
      },
    ]);
  });

  it("returns an empty ongs list when a ngo-mentor row has no ong", async () => {
    const rows = [
      {
        program: { documentId: "prog-1", name: "Program A" },
        ong: null,
        mentors: [{ documentId: "mentor-1" }],
      },
    ];

    (globalThis as any).strapi = {
      documents: () => ({
        findMany: async () => rows,
      }),
    };

    const result = await resolveProgramsByMentor(["mentor-1"]);

    expect(result.get("mentor-1")).toEqual([
      { documentId: "prog-1", name: "Program A", ongs: [] },
    ]);
  });
});
