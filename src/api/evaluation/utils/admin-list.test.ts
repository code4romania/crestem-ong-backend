import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../../constants/dimensions";
import {
  ADMIN_EVALUATION_POPULATE,
  adminEvaluationDbFilters,
  buildAdminEvaluationRows,
  needsInMemoryPagination,
  paginate,
} from "./admin-list";

const TODAY = "2026-03-01";

/** Every dimension submitted and answered, so the evaluation scores. */
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

const evaluation = (overrides: Record<string, any> = {}) => ({
  documentId: "eval-1",
  completedAt: null,
  dimensions: [],
  user: {
    documentId: "user-1",
    nume: "Ana Pop",
    email: "ana@example.org",
    accountStatus: "active",
  },
  report: {
    documentId: "report-1",
    name: "Runda 1",
    createdAt: "2026-01-10T10:00:00.000Z",
    finished: false,
    phases: [],
    ong: { documentId: "ong-1", name: "Asociația Alfa" },
  },
  ...overrides,
});

describe("buildAdminEvaluationRows", () => {
  it("maps the organization, respondent, status and completion date of an evaluation", () => {
    const rows = buildAdminEvaluationRows(
      [
        evaluation({
          completedAt: "2026-02-02T08:00:00.000Z",
          dimensions: completeDimensions(3),
        }),
      ],
      { today: TODAY },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      documentId: "eval-1",
      ong: { documentId: "ong-1", name: "Asociația Alfa" },
      user: { documentId: "user-1", nume: "Ana Pop", email: "ana@example.org" },
      status: "completat",
      completedAt: "2026-02-02T08:00:00.000Z",
      report: { documentId: "report-1", name: "Runda 1" },
    });
  });

  it("scores a completed evaluation and leaves an unfinished one without a score", () => {
    const rows = buildAdminEvaluationRows(
      [
        evaluation({ dimensions: completeDimensions(3) }),
        evaluation({ documentId: "eval-2", dimensions: [] }),
      ],
      { today: TODAY },
    );

    expect(typeof rows.find((row) => row.documentId === "eval-1")!.score).toBe("number");
    expect(rows.find((row) => row.documentId === "eval-2")!.score).toBeNull();
  });

  it("marks a report with no phases as independent", () => {
    const rows = buildAdminEvaluationRows([evaluation()], { today: TODAY });

    expect(rows[0].independent).toBe(true);
    expect(rows[0].programs).toEqual([]);
  });

  it("lists each program of the report once, however many of its phases the report spans", () => {
    const rows = buildAdminEvaluationRows(
      [
        evaluation({
          report: {
            ...evaluation().report,
            phases: [phase("Faza 1", "Acceleratorul"), phase("Faza 2", "Acceleratorul"), phase("Faza 3", "Mentorat")],
          },
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

  it("keeps only the evaluations in the requested status", () => {
    const rows = buildAdminEvaluationRows(
      [
        evaluation({ dimensions: completeDimensions(3) }),
        evaluation({ documentId: "eval-2", dimensions: [] }),
      ],
      { today: TODAY, status: "completat" },
    );

    expect(rows.map((row) => row.documentId)).toEqual(["eval-1"]);
  });

  it("reports a respondent of a closed round who never finished as nefinalizat", () => {
    const rows = buildAdminEvaluationRows(
      [
        evaluation({
          report: { ...evaluation().report, finished: true },
          dimensions: [{ dimensionKey: DIMENSIONS[0].key, submitted: true, quiz: [] }],
        }),
      ],
      { today: TODAY },
    );

    expect(rows[0].status).toBe("nefinalizat");
  });

  it("sorts the newest round first and orders respondents of one round by name", () => {
    const older = {
      ...evaluation().report,
      documentId: "report-0",
      createdAt: "2025-11-01T10:00:00.000Z",
    };
    const rows = buildAdminEvaluationRows(
      [
        evaluation({ documentId: "eval-old", report: older }),
        evaluation({
          documentId: "eval-zoe",
          user: { documentId: "user-2", nume: "Zoe Ionescu", email: "zoe@example.org", accountStatus: "active" },
        }),
        evaluation({ documentId: "eval-ana" }),
      ],
      { today: TODAY },
    );

    expect(rows.map((row) => row.documentId)).toEqual(["eval-ana", "eval-zoe", "eval-old"]);
  });

  it("ranks a member invited later above the rest of an older round", () => {
    const oldRound = {
      ...evaluation().report,
      documentId: "report-0",
      createdAt: "2025-11-01T10:00:00.000Z",
    };
    const rows = buildAdminEvaluationRows(
      [
        evaluation({
          documentId: "eval-late-invite",
          createdAt: "2026-02-20T10:00:00.000Z",
          report: oldRound,
        }),
        evaluation({ documentId: "eval-current", createdAt: "2026-01-10T10:00:00.000Z" }),
      ],
      { today: TODAY },
    );

    expect(rows.map((row) => row.documentId)).toEqual([
      "eval-late-invite",
      "eval-current",
    ]);
  });

  it("withholds the placeholder address of a deleted account", () => {
    const rows = buildAdminEvaluationRows(
      [
        evaluation({
          user: {
            documentId: "user-3",
            nume: "Anonim user-3",
            email: "deleted-user-3@anonim.local",
            accountStatus: "deleted",
          },
        }),
      ],
      { today: TODAY },
    );

    expect(rows[0].user).toEqual({
      documentId: "user-3",
      nume: "Anonim user-3",
      email: null,
    });
  });

  it("survives an evaluation whose report or respondent is missing", () => {
    const rows = buildAdminEvaluationRows(
      [{ documentId: "eval-orphan", dimensions: [], user: null, report: null }],
      { today: TODAY },
    );

    expect(rows[0]).toMatchObject({
      ong: null,
      user: null,
      report: null,
      independent: true,
      status: "neinceput",
      score: null,
    });
  });
});

describe("the independent entry of the program filter", () => {
  const inProgram = evaluation({
    documentId: "eval-in-program",
    report: { ...evaluation().report, phases: [phase("Faza 1", "Acceleratorul")] },
  });
  const inOtherProgram = evaluation({
    documentId: "eval-other-program",
    report: { ...evaluation().report, phases: [phase("Faza 1", "Mentorat")] },
  });
  const outsideEveryProgram = evaluation({ documentId: "eval-independent" });

  it("keeps only the rounds outside every program", () => {
    const rows = buildAdminEvaluationRows(
      [inProgram, inOtherProgram, outsideEveryProgram],
      { today: TODAY, programs: ["independent"] },
    );

    expect(rows.map((row) => row.documentId)).toEqual(["eval-independent"]);
  });

  it("keeps the rounds of the programs picked alongside it", () => {
    const rows = buildAdminEvaluationRows(
      [inProgram, inOtherProgram, outsideEveryProgram],
      { today: TODAY, programs: ["independent", "program-Acceleratorul"] },
    );

    expect(rows.map((row) => row.documentId).sort()).toEqual([
      "eval-in-program",
      "eval-independent",
    ]);
  });

  it("leaves the rows untouched when the filter names programs only", () => {
    // Programs alone are a database filter; narrowing again here would drop the
    // rows the query already matched.
    const rows = buildAdminEvaluationRows(
      [inProgram, inOtherProgram, outsideEveryProgram],
      { today: TODAY, programs: ["program-Acceleratorul"] },
    );

    expect(rows).toHaveLength(3);
  });
});

describe("paginate", () => {
  it("returns the requested slice and the pagination meta of the whole set", () => {
    const rows = Array.from({ length: 25 }, (_, index) => index);

    expect(paginate(rows, 2, 20)).toEqual({
      data: [20, 21, 22, 23, 24],
      pagination: { page: 2, pageSize: 20, pageCount: 2, total: 25 },
    });
  });

  it("reports a single empty page for an empty set", () => {
    expect(paginate([], 1, 20)).toEqual({
      data: [],
      pagination: { page: 1, pageSize: 20, pageCount: 1, total: 0 },
    });
  });
});

describe("adminEvaluationDbFilters", () => {
  it("has no filter when nothing is requested", () => {
    expect(adminEvaluationDbFilters({})).toEqual({});
  });

  it("searches the respondent's address alone", () => {
    expect(adminEvaluationDbFilters({ search: "ana@" })).toEqual({
      user: { email: { $containsi: "ana@" } },
    });
  });

  it("ignores a blank search", () => {
    expect(adminEvaluationDbFilters({ search: "   " })).toEqual({});
  });

  it("scopes to the organizations picked", () => {
    expect(adminEvaluationDbFilters({ ongs: ["ong-1", "ong-2"] })).toEqual({
      report: { ong: { documentId: { $in: ["ong-1", "ong-2"] } } },
    });
  });

  it("scopes to the programs picked", () => {
    expect(adminEvaluationDbFilters({ programs: ["program-1"] })).toEqual({
      report: { phases: { program: { documentId: { $in: ["program-1"] } } } },
    });
  });

  it("drops the program clause when the independent entry is picked, since no query selects a round without phases", () => {
    expect(
      adminEvaluationDbFilters({ programs: ["independent", "program-1"] }),
    ).toEqual({});
  });

  it("combines the organization scope with the search", () => {
    expect(
      adminEvaluationDbFilters({ ongs: ["ong-1"], search: "ana@" }),
    ).toEqual({
      user: { email: { $containsi: "ana@" } },
      report: { ong: { documentId: { $in: ["ong-1"] } } },
    });
  });

  it("keeps both relation scopes under the same report filter", () => {
    expect(
      adminEvaluationDbFilters({ ongs: ["ong-1"], programs: ["program-1"] }),
    ).toEqual({
      report: {
        ong: { documentId: { $in: ["ong-1"] } },
        phases: { program: { documentId: { $in: ["program-1"] } } },
      },
    });
  });
});

describe("needsInMemoryPagination", () => {
  it("is false for the filters the database answers on its own", () => {
    expect(
      needsInMemoryPagination({ ongs: ["ong-1"], programs: ["program-1"] }),
    ).toBe(false);
  });

  it("is true when the status is filtered, since status is derived", () => {
    expect(needsInMemoryPagination({ status: "completat" })).toBe(true);
  });

  it("is true when the independent entry is picked, since it is derived too", () => {
    expect(needsInMemoryPagination({ programs: ["independent"] })).toBe(true);
  });
});

describe("populate shape", () => {
  // The answers live in a component nested inside the `dimensions` component, and
  // `dimensions: true` stops at the outer one: the blocks come back without their
  // quiz, every dimension reads as incomplete and every score comes out null.
  it("asks for the quiz answers the score is computed from", () => {
    expect(ADMIN_EVALUATION_POPULATE.dimensions).toEqual({
      populate: { quiz: true },
    });
  });
});
