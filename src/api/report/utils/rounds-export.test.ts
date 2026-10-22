import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../../constants/dimensions";
import { enrollmentKey } from "../../../utils/program-enrollments";
import {
  ROUNDS_COLUMNS,
  respondentRows,
  roundRow,
  roundRows,
  roundsFileName,
} from "./rounds-export";

const TODAY = "2026-10-21";
const [guvernanta] = DIMENSIONS;
const column = (header: string) => {
  const index = ROUNDS_COLUMNS.findIndex((c) => c.header === header);
  if (index < 0) throw new Error(`no column ${header}`);
  return index;
};

const respondent = (answer: number, completedAt: string | null, comment = "") => ({
  completedAt,
  dimensions: DIMENSIONS.map((dimension) => ({
    dimensionKey: dimension.key,
    submitted: true,
    comment: dimension.key === guvernanta.key ? comment : "",
    quiz: dimension.quiz.map((question) => ({ questionId: question.id, answer })),
  })),
});

const ong = {
  documentId: "ong-1",
  cui: "RO123",
  name: "Asociația A",
  ngoStatus: "active",
  domeniuPrincipal: { name: "Educație" },
  domeniuSecundar: null,
  localitate: { nume: "Sectorul 1" },
  judet: { nume: "București" },
};

const programRound = {
  documentId: "round-1",
  createdAt: "2026-03-01T22:30:00.000Z",
  finished: false,
  ong,
  phases: [
    {
      title: "Etapa inițială",
      startDate: "2026-03-02",
      endDate: "2026-03-30",
      program: { documentId: "p1", name: "SCA1 - FDSC" },
    },
  ],
  evaluations: [
    respondent(5, "2026-03-10T08:00:00.000Z", "Avem viziune."),
    respondent(3, "2026-03-20T22:30:00.000Z", "  "),
    // Invited, never started.
    { completedAt: null, dimensions: [] },
  ],
};

const context = {
  admins: new Map([["ong-1", { nume: "Ana Pop", email: "ana@a.ro" }]]),
  mentors: new Map([
    ["ong-1", new Map([["p1", [{ documentId: "m1", nume: "Ion Mentor" }]]])],
  ]),
  enrollments: new Map([[enrollmentKey("ong-1", "p1"), "2026-02-14T10:00:00.000Z"]]),
  today: TODAY,
};

describe("ROUNDS_COLUMNS", () => {
  it("has the 18 base columns, then 7 per dimension", () => {
    expect(ROUNDS_COLUMNS).toHaveLength(18 + DIMENSIONS.length * 7);
    expect(ROUNDS_COLUMNS[18].header).toBe("Scor Guvernanță (%)");
    expect(ROUNDS_COLUMNS[19].header).toBe("Scor Viziune și misiune (%)");
    expect(ROUNDS_COLUMNS[24].header).toBe("Comentarii Guvernanță");
  });
});

describe("roundRow", () => {
  const row = roundRow(programRound, context);

  it("fills the organization and the round", () => {
    expect(row).toHaveLength(ROUNDS_COLUMNS.length);
    expect(row[column("ID evaluare")]).toBe("round-1");
    expect(row[column("CIF")]).toBe("RO123");
    expect(row[column("Nume ONG")]).toBe("Asociația A");
    expect(row[column("Nume reprezentant")]).toBe("Ana Pop");
    expect(row[column("Email reprezentant")]).toBe("ana@a.ro");
    expect(row[column("Domeniu principal")]).toBe("Educație");
    expect(row[column("Domeniu secundar")]).toBe("—");
    expect(row[column("Localitate")]).toBe("Sectorul 1");
    expect(row[column("Judet")]).toBe("București");
    expect(row[column("Persoană resursă alocată")]).toBe("Ion Mentor");
  });

  it("describes the program, phase and its period", () => {
    expect(row[column("Program(e)")]).toBe("SCA1 - FDSC");
    expect(row[column("Fază program")]).toBe("Etapa inițială");
    expect(row[column("Perioada fazei din program")]).toBe("02.03.2026 – 30.03.2026");
    expect(row[column("Dată intrare program")]).toBe("2026-02-14");
  });

  it("starts when the round was created and ends at the last completion", () => {
    // 22:30 UTC is already the next day in Bucharest (UTC+2 in March).
    expect(row[column("Dată început evaluare")]).toBe("2026-03-02");
    expect(row[column("Dată final evaluare")]).toBe("2026-03-21");
  });

  it("scores the round and counts completions against invitations", () => {
    // 100% and 50% respondents average to 75%.
    expect(row[column("Scor total obținut (%)")]).toBe(75);
    expect(row[column("Număr de completări")]).toBe("2/3");
    expect(row[column("Scor Guvernanță (%)")]).toBe(75);
    expect(row[column("Scor Viziune și misiune (%)")]).toBe(75);
  });

  it("leaves the arguments to the respondents' rows", () => {
    expect(row[column("Comentarii Guvernanță")]).toBe("—");
    expect(row[column("Comentarii Aspecte financiare")]).toBe("—");
  });

  it("puts one line per program when a round sits in two", () => {
    const twoPrograms = {
      ...programRound,
      phases: [
        programRound.phases[0],
        {
          title: "Etapa inițială",
          startDate: "2026-03-05",
          endDate: "2026-04-04",
          program: { documentId: "p2", name: "SCA1 - ARC" },
        },
      ],
    };
    const result = roundRow(twoPrograms, context);
    expect(result[column("Program(e)")]).toBe("SCA1 - FDSC\nSCA1 - ARC");
    expect(result[column("Fază program")]).toBe("Etapa inițială\nEtapa inițială");
    expect(result[column("Perioada fazei din program")]).toBe(
      "02.03.2026 – 30.03.2026\n05.03.2026 – 04.04.2026",
    );
    // Several dates can only be text; the second program predates the enrollments.
    expect(result[column("Dată intrare program")]).toBe("14.02.2026\n—");
  });

  it("marks an independent round and a retired organization", () => {
    const independent = {
      ...programRound,
      phases: [],
      ong: { ...ong, ngoStatus: "deleted" },
      evaluations: [{ completedAt: null, dimensions: [] }],
    };
    const result = roundRow(independent, context);
    expect(result[column("Nume ONG")]).toBe("Asociația A (Retras)");
    expect(result[column("Program(e)")]).toBe("Independentă");
    expect(result[column("Fază program")]).toBe("—");
    expect(result[column("Perioada fazei din program")]).toBe("—");
    expect(result[column("Dată intrare program")]).toBe("—");
    expect(result[column("Persoană resursă alocată")]).toBe("N/A");
    expect(result[column("Dată final evaluare")]).toBe("—");
    expect(result[column("Scor total obținut (%)")]).toBe("—");
    expect(result[column("Număr de completări")]).toBe("0/1");
  });
});

describe("respondentRows", () => {
  const draft = {
    documentId: "eval-draft",
    completedAt: null,
    createdAt: "2026-03-03T08:00:00.000Z",
    user: null,
    dimensions: [
      {
        dimensionKey: guvernanta.key,
        submitted: true,
        comment: "Doar guvernanța.",
        quiz: guvernanta.quiz.map((question) => ({ questionId: question.id, answer: 5 })),
      },
      { dimensionKey: DIMENSIONS[1].key, submitted: false, comment: "ciornă", quiz: [] },
    ],
  };
  const evaluations = [
    { ...respondent(3, "2026-03-20T22:30:00.000Z"), documentId: "eval-late", user: { nume: "Maria", email: "maria@a.ro" } },
    draft,
    { completedAt: null, dimensions: [], documentId: "eval-none", user: null },
    { ...respondent(5, "2026-03-10T08:00:00.000Z", "Avem viziune."), documentId: "eval-early", user: { nume: "Ana Pop", email: "ana@a.ro" } },
    { ...respondent(4, "2026-03-15T08:00:00.000Z"), documentId: "eval-gone", user: { nume: "Anonim x", email: "deleted-x@anonim.local", accountStatus: "deleted" } },
  ];
  const rows = respondentRows(evaluations, "RO123");

  it("lists who saved anything, in completion order, drafts last", () => {
    expect(rows.map((r) => r[column("ID evaluare")])).toEqual([
      "eval-early",
      "eval-gone",
      "eval-late",
      "eval-draft",
    ]);
  });

  it("names each respondent like the per-round export", () => {
    expect(rows.map((r) => r[column("Nume reprezentant")])).toEqual([
      "Ana Pop",
      "Cont șters",
      "Maria",
      "Evaluator 1 (ciornă)",
    ]);
    expect(rows.map((r) => r[column("Email reprezentant")])).toEqual([
      "ana@a.ro",
      "—",
      "maria@a.ro",
      "—",
    ]);
  });

  it("scores and comments each respondent alone", () => {
    const [early, , late, partial] = rows;
    expect(early[column("Scor total obținut (%)")]).toBe(100);
    expect(late[column("Scor total obținut (%)")]).toBe(50);
    expect(early[column("Comentarii Guvernanță")]).toBe("Avem viziune.");
    expect(late[column("Comentarii Guvernanță")]).toBe("—");
    // A draft scores only what it sent, and has no total yet.
    expect(partial[column("Scor Guvernanță (%)")]).toBe(100);
    expect(partial[column("Comentarii Guvernanță")]).toBe("Doar guvernanța.");
    expect(partial[column("Scor Aspecte financiare (%)")]).toBe("—");
    expect(partial[column("Scor total obținut (%)")]).toBe("—");
  });

  it("keeps the fiscal code and leaves every other organization column empty", () => {
    expect(rows.every((r) => r[column("CIF")] === "RO123")).toBe(true);
    for (const header of ["Nume ONG", "Program(e)", "Dată final evaluare", "Număr de completări"]) {
      expect(rows[0][column(header)]).toBeNull();
    }
    expect(rows[0]).toHaveLength(ROUNDS_COLUMNS.length);
  });
});

describe("roundRows", () => {
  it("groups the respondents under their round", () => {
    const [first, ...rest] = roundRows(programRound, context);
    expect(Array.isArray(first) && first[column("ID evaluare")]).toBe("round-1");
    expect(rest).toHaveLength(2);
    expect(rest.every((r) => !Array.isArray(r) && r.outlineLevel === 1)).toBe(true);
  });
});

describe("roundsFileName", () => {
  it("dates the file by the download day", () => {
    expect(roundsFileName(TODAY)).toBe("evaluari-2026-10-21.xlsx");
  });
});
