import { describe, expect, it } from "vitest";
import { buildOngDashboard, scoreSummary } from "./ong";

describe("scoreSummary", () => {
  it("reports the newest round's score and the average of every scored round", () => {
    expect(
      scoreSummary([
        { overall: 20, at: "2026-01-10" },
        { overall: 40, at: "2026-03-10" },
        { overall: 30, at: "2026-02-10" },
      ]),
    ).toEqual({ lastScore: 40, averageScore: 30 });
  });

  it("skips rounds with no overall score when averaging", () => {
    expect(
      scoreSummary([
        { overall: 20, at: "2026-01-10" },
        { overall: null, at: "2026-02-10" },
        { overall: 60, at: "2026-03-10" },
      ]),
    ).toEqual({ lastScore: 60, averageScore: 40 });
  });

  it("takes the newest round's score even when it is null", () => {
    expect(
      scoreSummary([
        { overall: 20, at: "2026-01-10" },
        { overall: null, at: "2026-03-10" },
      ]),
    ).toEqual({ lastScore: null, averageScore: 20 });
  });

  it("returns null for both when no round has a score", () => {
    expect(scoreSummary([{ overall: null, at: "2026-01-10" }])).toEqual({
      lastScore: null,
      averageScore: null,
    });
  });

  it("returns null for both when there are no rounds at all", () => {
    expect(scoreSummary([])).toEqual({ lastScore: null, averageScore: null });
  });

  it("rounds the average to one decimal", () => {
    expect(
      scoreSummary([
        { overall: 10, at: "2026-01-10" },
        { overall: 20, at: "2026-02-10" },
        { overall: 25, at: "2026-03-10" },
      ]).averageScore,
    ).toBe(18.3);
  });
});

const TODAY = "2026-06-15";

const mockStrapi = ({
  memberCount = 0,
  programs = [] as any[],
  reports = [] as any[],
  ngoMentors = [] as any[],
} = {}) => ({
  documents: (uid: string) => ({
    count: async () => memberCount,
    findMany: async () => {
      if (uid === "api::program.program") return programs;
      if (uid === "api::report.report") return reports;
      if (uid === "api::ngo-mentor.ngo-mentor") return ngoMentors;
      return [];
    },
  }),
});

describe("buildOngDashboard", () => {
  it("counts the organization's members", async () => {
    const result = await buildOngDashboard(mockStrapi({ memberCount: 18 }), "ong-1", TODAY);

    expect(result.memberCount).toBe(18);
  });

  it("counts every program and, separately, the active ones", async () => {
    const strapi = mockStrapi({
      programs: [
        { documentId: "p1", name: "A", startDate: "2025-01-01", programStatus: "Active" },
        { documentId: "p2", name: "B", startDate: "2024-01-01", programStatus: "Finished" },
        { documentId: "p3", name: "C", startDate: "2026-01-01", programStatus: "Active" },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.programCount).toBe(3);
    expect(result.activeProgramCount).toBe(2);
  });

  it("lists the three newest programs, newest first", async () => {
    const strapi = mockStrapi({
      programs: [
        { documentId: "p1", name: "A", startDate: "2023-01-01", programStatus: "Finished" },
        { documentId: "p2", name: "B", startDate: "2026-01-01", programStatus: "Active" },
        { documentId: "p3", name: "C", startDate: "2024-01-01", programStatus: "Finished" },
        { documentId: "p4", name: "D", startDate: "2025-01-01", programStatus: "Active" },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.recentPrograms).toEqual([
      { documentId: "p2", name: "B", programStatus: "Active" },
      { documentId: "p4", name: "D", programStatus: "Active" },
      { documentId: "p3", name: "C", programStatus: "Finished" },
    ]);
  });

  it("counts the finished evaluation rounds", async () => {
    const strapi = mockStrapi({
      reports: [
        { documentId: "r1", finished: true, finishedAt: "2026-01-01", evaluations: [] },
        { documentId: "r2", finished: true, finishedAt: "2026-02-01", evaluations: [] },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.finishedReportCount).toBe(2);
  });

  it("counts a round auto-closed by its phases ending, not just the finished column", async () => {
    const strapi = mockStrapi({
      reports: [
        {
          documentId: "r1",
          finished: false,
          finishedAt: null,
          phases: [{ endDate: "2026-05-31" }],
          evaluations: [],
        },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.finishedReportCount).toBe(1);
  });

  it("leaves a still-running round out of the count", async () => {
    const strapi = mockStrapi({
      reports: [
        {
          documentId: "r1",
          finished: false,
          finishedAt: null,
          phases: [{ endDate: "2026-12-31" }],
          evaluations: [],
        },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.finishedReportCount).toBe(0);
  });

  it("pairs each mentor with the program the assignment belongs to", async () => {
    const strapi = mockStrapi({
      programs: [
        {
          documentId: "p1",
          name: "În stare de bine",
          startDate: "2025-01-15",
          endDate: "2026-12-31",
          programStatus: "Active",
          mentors: [{ documentId: "m1" }],
        },
      ],
      ngoMentors: [
        {
          documentId: "nm1",
          program: [{ documentId: "p1" }],
          mentors: [
            {
              documentId: "m1",
              nume: "Simona Vlad",
              email: "simona@example.com",
              mentorJobTitle: "Expert Advocacy & Politici publice",
              avatar: null,
            },
          ],
        },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.mentors).toEqual([
      {
        documentId: "m1",
        nume: "Simona Vlad",
        mentorJobTitle: "Expert Advocacy & Politici publice",
        avatar: null,
        program: {
          documentId: "p1",
          name: "În stare de bine",
          startDate: "2025-01-15",
          endDate: "2026-12-31",
        },
      },
    ]);
  });

  it("drops a mentor who is on the assignment row but no longer on the program", async () => {
    const strapi = mockStrapi({
      programs: [
        {
          documentId: "p1",
          name: "În stare de bine",
          startDate: "2025-01-15",
          endDate: "2026-12-31",
          programStatus: "Active",
          mentors: [{ documentId: "m1" }],
        },
      ],
      ngoMentors: [
        {
          documentId: "nm1",
          program: [{ documentId: "p1" }],
          mentors: [
            { documentId: "m1", nume: "Simona Vlad", mentorJobTitle: null, avatar: null },
            { documentId: "m2", nume: "Cristian Neagu", mentorJobTitle: null, avatar: null },
          ],
        },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.mentors.map((mentor) => mentor.documentId)).toEqual(["m1"]);
  });

  it("ignores an assignment row whose program the organization is not enrolled in", async () => {
    const strapi = mockStrapi({
      programs: [],
      ngoMentors: [
        {
          documentId: "nm1",
          program: [{ documentId: "p-unknown" }],
          mentors: [{ documentId: "m1", nume: "Simona Vlad", avatar: null }],
        },
      ],
    });

    const result = await buildOngDashboard(strapi, "ong-1", TODAY);

    expect(result.mentors).toEqual([]);
  });

  it("returns empty collections and null scores for an organization with no activity", async () => {
    const result = await buildOngDashboard(mockStrapi(), "ong-1", TODAY);

    expect(result).toEqual({
      memberCount: 0,
      programCount: 0,
      activeProgramCount: 0,
      finishedReportCount: 0,
      lastScore: null,
      averageScore: null,
      mentors: [],
      recentPrograms: [],
    });
  });
});
