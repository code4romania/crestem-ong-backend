import { describe, expect, it } from "vitest";
import { buildFdscDashboard } from "./fdsc";

const TODAY = "2026-06-15";

/**
 * Counts the fixture rows the way the document service would, so the tests
 * assert on the counting rule itself rather than on the filter object the
 * builder happens to pass.
 */
const matches = (row: any, filters: any = {}) =>
  Object.entries(filters).every(([field, condition]) => {
    if (condition && typeof condition === "object" && "$ne" in condition) {
      return row[field] !== (condition as any).$ne;
    }
    return row[field] === condition;
  });

const mockStrapi = (rows: Record<string, any[]>) => ({
  documents: (uid: string) => ({
    count: async ({ filters }: any = {}) =>
      (rows[uid] ?? []).filter((row) => matches(row, filters)).length,
    findMany: async () => rows[uid] ?? [],
  }),
});

describe("buildFdscDashboard", () => {
  it("counts registered organizations, excluding the withdrawn ones", async () => {
    const strapi = mockStrapi({
      "api::ong.ong": [
        { documentId: "o1", ngoStatus: "active" },
        { documentId: "o2", ngoStatus: "deleted" },
        { documentId: "o3", ngoStatus: "active" },
      ],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.ongCount).toBe(2);
  });

  it("keeps blocked organizations in the count — they are still registered", async () => {
    const strapi = mockStrapi({
      "api::ong.ong": [
        { documentId: "o1", ngoStatus: "active" },
        { documentId: "o2", ngoStatus: "blocked" },
      ],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.ongCount).toBe(2);
  });

  it("counts rounds closed manually", async () => {
    const strapi = mockStrapi({
      "api::report.report": [
        { documentId: "r1", finished: true, phases: [] },
        { documentId: "r2", finished: false, phases: [] },
        { documentId: "r3", finished: true, phases: [] },
      ],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.finishedReportCount).toBe(2);
  });

  it("counts a round whose phases have all ended, even with finished still false", async () => {
    // A round auto-closes when its last phase ends; `finished` stays false in
    // the database. Every other screen reports it as finalized via `isClosed`.
    const strapi = mockStrapi({
      "api::report.report": [
        {
          documentId: "r1",
          finished: false,
          phases: [{ endDate: "2026-05-31" }, { endDate: "2026-04-30" }],
        },
      ],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.finishedReportCount).toBe(1);
  });

  it("does not count a round whose phases are still running", async () => {
    const strapi = mockStrapi({
      "api::report.report": [
        {
          documentId: "r1",
          finished: false,
          phases: [{ endDate: "2026-05-31" }, { endDate: "2026-12-31" }],
        },
      ],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.finishedReportCount).toBe(0);
  });

  it("does not count an independent round with no phases until it is finished", async () => {
    const strapi = mockStrapi({
      "api::report.report": [{ documentId: "r1", finished: false, phases: [] }],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.finishedReportCount).toBe(0);
  });

  it("counts only active programs", async () => {
    const strapi = mockStrapi({
      "api::program.program": [
        { documentId: "p1", programStatus: "Active" },
        { documentId: "p2", programStatus: "Upcoming" },
        { documentId: "p3", programStatus: "Finished" },
      ],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.activeProgramCount).toBe(1);
  });

  it("counts every uploaded FDSC report", async () => {
    const strapi = mockStrapi({
      "api::fdsc-report.fdsc-report": [{ documentId: "f1" }, { documentId: "f2" }],
    });

    const result = await buildFdscDashboard(strapi, TODAY);

    expect(result.fdscReportCount).toBe(2);
  });

  it("returns zeroes on an empty platform rather than omitting the counters", async () => {
    const result = await buildFdscDashboard(mockStrapi({}), TODAY);

    expect(result).toEqual({
      ongCount: 0,
      finishedReportCount: 0,
      activeProgramCount: 0,
      fdscReportCount: 0,
    });
  });
});
