import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../../constants/dimensions";
import {
  ADMIN_REPORT_POPULATE,
  adminReportDbFilters,
  buildAdminReportRows,
  reportNeedsInMemoryPagination,
} from "./admin-report-list";

const TODAY = "2026-03-01";

const completeDimensions = (answer: number) =>
  DIMENSIONS.map((dimension) => ({
    dimensionKey: dimension.key,
    submitted: true,
    quiz: dimension.quiz.map((question) => ({
      questionId: question.id,
      answer,
    })),
  }));

const phase = (title: string, programName: string | null, endDate = "2026-06-30") => ({
  documentId: `phase-${title}`,
  title,
  endDate,
  program: programName
    ? { documentId: `program-${programName}`, name: programName }
    : null,
});

const report = (overrides: Record<string, any> = {}) => ({
  documentId: "report-1",
  name: "Runda 1",
  createdAt: "2026-01-10T10:00:00.000Z",
  finished: false,
  finishedAt: null,
  phases: [],
  ong: { documentId: "ong-1", name: "Asociația Alfa", cui: "RO123" },
  evaluations: [],
  ...overrides,
});

describe("buildAdminReportRows", () => {
  it("maps the organization, the round and its state", () => {
    const rows = buildAdminReportRows([report()], { today: TODAY });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      documentId: "report-1",
      name: "Runda 1",
      ong: { documentId: "ong-1", name: "Asociația Alfa" },
      roundStatus: "in_desfasurare",
      independent: true,
      programs: [],
      finishedAt: null,
    });
  });

  it("reports a finished round as finalizata, with its date", () => {
    const rows = buildAdminReportRows(
      [report({ finished: true, finishedAt: "2026-02-20T09:00:00.000Z" })],
      { today: TODAY },
    );

    expect(rows[0].roundStatus).toBe("finalizata");
    expect(rows[0].finishedAt).toBe("2026-02-20T09:00:00.000Z");
  });

  it("closes a round whose phases have all ended, even when it was never finished by hand", () => {
    const rows = buildAdminReportRows(
      [report({ phases: [phase("Faza 1", "Acceleratorul", "2026-02-01")] })],
      { today: TODAY },
    );

    expect(rows[0].roundStatus).toBe("finalizata");
  });

  it("counts the responses that are complete against the ones invited", () => {
    const rows = buildAdminReportRows(
      [
        report({
          evaluations: [
            { dimensions: completeDimensions(3) },
            { dimensions: completeDimensions(2) },
            { dimensions: [] },
          ],
        }),
      ],
      { today: TODAY },
    );

    expect(rows[0].completedCount).toBe(2);
    expect(rows[0].invitedCount).toBe(3);
  });

  it("scores the round over its responses and leaves an unanswered round unscored", () => {
    const [scored, unscored] = buildAdminReportRows(
      [
        report({
          documentId: "report-scored",
          createdAt: "2026-02-01T10:00:00.000Z",
          evaluations: [{ dimensions: completeDimensions(3) }],
        }),
        report({ documentId: "report-empty", evaluations: [{ dimensions: [] }] }),
      ],
      { today: TODAY },
    );

    expect(typeof scored.score).toBe("number");
    expect(unscored.score).toBeNull();
  });

  it("lists each program of the round once", () => {
    const rows = buildAdminReportRows(
      [
        report({
          phases: [
            phase("Faza 1", "Acceleratorul"),
            phase("Faza 2", "Acceleratorul"),
            phase("Faza 3", "Mentorat"),
          ],
        }),
      ],
      { today: TODAY },
    );

    expect(rows[0].independent).toBe(false);
    expect(rows[0].programs).toEqual([
      { documentId: "program-Acceleratorul", name: "Acceleratorul" },
      { documentId: "program-Mentorat", name: "Mentorat" },
    ]);
  });

  it("keeps the rounds with at least one response in the requested status", () => {
    const rows = buildAdminReportRows(
      [
        report({
          documentId: "report-with-complete",
          evaluations: [{ dimensions: [] }, { dimensions: completeDimensions(3) }],
        }),
        report({ documentId: "report-untouched", evaluations: [{ dimensions: [] }] }),
      ],
      { today: TODAY, status: "completat" },
    );

    expect(rows.map((row) => row.documentId)).toEqual(["report-with-complete"]);
  });

  it("keeps the rounds outside every program when the independent entry is picked", () => {
    const rows = buildAdminReportRows(
      [
        report({
          documentId: "report-in-program",
          phases: [phase("Faza 1", "Acceleratorul")],
        }),
        report({ documentId: "report-independent" }),
      ],
      { today: TODAY, programs: ["independent"] },
    );

    expect(rows.map((row) => row.documentId)).toEqual(["report-independent"]);
  });

  it("sorts the newest round first", () => {
    const rows = buildAdminReportRows(
      [
        report({ documentId: "report-old", createdAt: "2025-11-01T10:00:00.000Z" }),
        report({ documentId: "report-new", createdAt: "2026-02-01T10:00:00.000Z" }),
      ],
      { today: TODAY },
    );

    expect(rows.map((row) => row.documentId)).toEqual(["report-new", "report-old"]);
  });

  it("survives a round whose organization is gone", () => {
    const rows = buildAdminReportRows([report({ ong: null })], { today: TODAY });

    expect(rows[0].ong).toBeNull();
  });
});

describe("adminReportDbFilters", () => {
  it("has no filter when nothing is requested", () => {
    expect(adminReportDbFilters({})).toEqual({});
  });

  it("searches the administrators' addresses and the fiscal code", () => {
    expect(adminReportDbFilters({ search: "alfa" })).toEqual({
      $or: [
        {
          ong: {
            users: {
              email: { $containsi: "alfa" },
              role: { type: "ngo-admin" },
            },
          },
        },
        { ong: { cui: { $containsi: "alfa" } } },
      ],
    });
  });

  it("scopes to the organizations picked", () => {
    expect(adminReportDbFilters({ ongs: ["ong-1"] })).toEqual({
      ong: { documentId: { $in: ["ong-1"] } },
    });
  });

  it("scopes to the programs picked", () => {
    expect(adminReportDbFilters({ programs: ["program-1"] })).toEqual({
      phases: { program: { documentId: { $in: ["program-1"] } } },
    });
  });

  it("drops the program clause when the independent entry is picked", () => {
    expect(adminReportDbFilters({ programs: ["independent"] })).toEqual({});
  });
});

describe("reportNeedsInMemoryPagination", () => {
  it("is false for the filters the database answers on its own", () => {
    expect(
      reportNeedsInMemoryPagination({ ongs: ["ong-1"], programs: ["program-1"] }),
    ).toBe(false);
  });

  it("is true for the status, which is derived from the responses", () => {
    expect(reportNeedsInMemoryPagination({ status: "completat" })).toBe(true);
  });

  it("is true for the independent entry", () => {
    expect(reportNeedsInMemoryPagination({ programs: ["independent"] })).toBe(true);
  });
});

describe("populate shape", () => {
  it("asks for the quiz answers the round score is computed from", () => {
    expect(ADMIN_REPORT_POPULATE.evaluations).toEqual({
      populate: { dimensions: { populate: { quiz: true } } },
    });
  });
});
