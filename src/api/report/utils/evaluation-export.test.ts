import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../../constants/dimensions";
import { buildEvaluationExport, exportFileName } from "./evaluation-export";

const [guvernanta, financiar] = DIMENSIONS;

/** A respondent who submitted every dimension, all answers `answer`. */
const complete = (email: string, answer: number) => ({
  user: { nume: `Nume ${email}`, email, accountStatus: "active" },
  dimensions: DIMENSIONS.map((dimension) => ({
    dimensionKey: dimension.key,
    submitted: true,
    comment: `argument ${dimension.key}`,
    quiz: dimension.quiz.map((question) => ({
      questionId: question.id,
      answer,
    })),
  })),
});

const programRound = (evaluations: any[]) => ({
  documentId: "round-1",
  createdAt: "2026-03-01T08:00:00.000Z",
  finishedAt: null,
  ong: { name: "Asociația Șoimii Ăștia", cui: "RO123" },
  phases: [
    {
      title: "Etapa inițială",
      startDate: "2026-03-02",
      endDate: "2026-03-30",
      program: { documentId: "p1", name: "SCA" },
    },
  ],
  evaluations,
});

const admin = { nume: "Ana Pop", email: "ana@ong.ro", telefon: "0722" };

const general = (result: ReturnType<typeof buildEvaluationExport>) =>
  Object.fromEntries(result.general.map((row) => [row.label, row.value]));

describe("exportFileName", () => {
  it("folds diacritics and punctuation into an ASCII slug", () => {
    expect(exportFileName("Asociația „Șoimii” Ăștia", "2026-03-02")).toBe(
      "evaluare-asociatia-soimii-astia-2026-03-02.xlsx",
    );
  });

  it("falls back when the name has nothing usable", () => {
    expect(exportFileName("", "2026-03-02")).toBe("evaluare-ong-2026-03-02.xlsx");
  });
});

describe("buildEvaluationExport — Date Generale", () => {
  it("fills the round, organization, contact, program and experts", () => {
    const result = buildEvaluationExport({
      report: programRound([complete("a@x.ro", 5), complete("b@x.ro", 3)]),
      closed: false,
      admin,
      mentorNames: ["Ion Mentor", "Maria Mentor"],
    });
    const rows = general(result);

    expect(rows["ID:"]).toBe("round-1");
    expect(rows["Nume ONG:"]).toBe("Asociația Șoimii Ăștia");
    expect(rows["CIF:"]).toBe("RO123");
    expect(rows["Dată început"]).toBe("02.03.2026");
    expect(rows["Dată final"]).toBe("30.03.2026");
    expect(rows["Număr completări"]).toBe("2/2");
    expect(rows["Nume persoană de contact organizație:"]).toBe("Ana Pop");
    expect(rows["Email persoană de contact organizație:"]).toBe("ana@ong.ro");
    expect(rows["Telefon persoană de contact organizație"]).toBe("0722");
    expect(rows["Program:"]).toBe("SCA");
    expect(rows["Fază:"]).toBe("Etapa inițială");
    expect(rows["Expert alocat (persoană resursă FDSC):"]).toBe(
      "Ion Mentor, Maria Mentor",
    );
    // 100% and 50% respondents average to 75%.
    expect(rows["Scor obținut"]).toEqual({ percent: 75 });
    expect(result.fileName).toBe(
      "evaluare-asociatia-soimii-astia-2026-03-02.xlsx",
    );
  });

  it("marks an independent round with NA and dates it by creation", () => {
    const report = {
      ...programRound([]),
      phases: [],
      createdAt: "2026-03-01T22:30:00.000Z",
      finishedAt: "2026-04-10T10:00:00.000Z",
    };
    const result = buildEvaluationExport({
      report,
      closed: true,
      admin: null,
      mentorNames: [],
    });
    const rows = general(result);

    // 22:30 UTC on 1 March is already 2 March in Bucharest.
    expect(rows["Dată început"]).toBe("02.03.2026");
    expect(rows["Dată final"]).toBe("10.04.2026");
    expect(rows["Program:"]).toBe("NA");
    expect(rows["Fază:"]).toBe("Independentă");
    expect(rows["Expert alocat (persoană resursă FDSC):"]).toBe("NA");
    expect(rows["Nume persoană de contact organizație:"]).toBe("—");
    expect(rows["Scor obținut"]).toBe("—");
    expect(rows["Număr completări"]).toBe("0/0");
    expect(result.fileName).toBe(
      "evaluare-asociatia-soimii-astia-2026-03-02.xlsx",
    );
  });

  it("shows an open independent round as still running", () => {
    const result = buildEvaluationExport({
      report: { ...programRound([]), phases: [] },
      closed: false,
      admin,
      mentorNames: [],
    });
    expect(general(result)["Dată final"]).toBe("în desfășurare");
  });

  it("lists dimensions in catalog order, whatever their score", () => {
    const respondent = complete("a@x.ro", 3);
    // Guvernanță all 5s (100%), Aspecte financiare all 1s (0%), the rest 50%.
    for (const block of respondent.dimensions) {
      if (block.dimensionKey === guvernanta.key) {
        block.quiz.forEach((q) => (q.answer = 5));
      }
      if (block.dimensionKey === financiar.key) {
        block.quiz.forEach((q) => (q.answer = 1));
      }
    }
    const result = buildEvaluationExport({
      report: programRound([respondent]),
      closed: false,
      admin,
      mentorNames: [],
    });

    expect(result.dimensions.map((d) => d.name)).toEqual(
      DIMENSIONS.map((d) => d.name),
    );
    expect(result.dimensions[0]).toMatchObject({
      name: guvernanta.name,
      value: { percent: 100 },
    });
    expect(result.dimensions[1]).toMatchObject({
      name: financiar.name,
      value: { percent: 0 },
    });
    expect(result.dimensions[2].value).toEqual({ percent: 50 });
  });

  it("lists each dimension's indicators by their tag, with the round average", () => {
    const result = buildEvaluationExport({
      report: programRound([complete("a@x.ro", 5), complete("b@x.ro", 3)]),
      closed: false,
      admin,
      mentorNames: [],
    });
    const [first] = result.dimensions;
    expect(first.indicators.map((i) => i.name)).toEqual(
      guvernanta.quiz.map((q) => (q.tag ?? q.question).trim()),
    );
    expect(first.indicators[0].name).toBe("Viziune și misiune");
    // 5/5 (100%) and 3/5 (50%) average to 75%.
    expect(first.indicators[0].value).toEqual({ percent: 75 });
  });
});

describe("buildEvaluationExport — Rezultate evaluări individuale", () => {
  const partial = {
    user: { nume: "Paul Parțial", email: "partial@x.ro", accountStatus: "active" },
    dimensions: [
      {
        dimensionKey: guvernanta.key,
        submitted: true,
        comment: "doar prima",
        quiz: guvernanta.quiz.map((question) => ({
          questionId: question.id,
          answer: 4,
        })),
      },
      {
        // A draft halfway through: shown, flagged, and without its argument yet.
        dimensionKey: financiar.key,
        submitted: false,
        comment: "",
        quiz: financiar.quiz.slice(0, 2).map((question) => ({
          questionId: question.id,
          answer: 2,
        })),
      },
    ],
  };
  const draftOnly = {
    user: { nume: "Dana Ciornă", email: "draft@x.ro", accountStatus: "active" },
    dimensions: [
      {
        dimensionKey: guvernanta.key,
        submitted: false,
        comment: "în lucru",
        quiz: [{ questionId: guvernanta.quiz[0].id, answer: 3 }],
      },
    ],
  };
  const deleted = {
    user: { nume: "Anonim abc", email: "deleted-1@anon", accountStatus: "deleted" },
    dimensions: complete("x", 1).dimensions,
  };
  const legacy = { user: null, dimensions: complete("y", 2).dimensions };
  const untouched = {
    user: { nume: "Nicio Încercare", email: "none@x.ro", accountStatus: "active" },
    dimensions: [],
  };

  const result = buildEvaluationExport({
    report: programRound([
      complete("full@x.ro", 5),
      untouched,
      partial,
      draftOnly,
      deleted,
      legacy,
    ]),
    closed: false,
    admin,
    mentorNames: [],
  });
  const row = (label: string) => result.rows.find((r) => r.label === label)!;

  it("names a column per respondent who saved anything, in invitation order", () => {
    expect(result.respondents).toEqual([
      { label: "Nume full@x.ro", email: "full@x.ro" },
      { label: "Paul Parțial", email: "partial@x.ro" },
      { label: "Dana Ciornă", email: "draft@x.ro" },
      { label: "Cont șters", email: "—" },
      { label: "Evaluator 1", email: "—" },
    ]);
  });

  it("still counts everyone invited in Număr completări", () => {
    const rows = Object.fromEntries(result.general.map((r) => [r.label, r.value]));
    expect(rows["Număr completări"]).toBe("3/6");
  });

  it("numbers dimensions and questions in catalog order", () => {
    const perDimension = 1 + guvernanta.quiz.length + 1;
    expect(result.rows).toHaveLength(
      DIMENSIONS.reduce((sum, d) => sum + d.quiz.length + 2, 0),
    );
    expect(result.rows[0]).toMatchObject({
      kind: "dimension",
      label: `1. ${guvernanta.name}`,
    });
    expect(result.rows[1]).toMatchObject({
      kind: "question",
      label: `1.1. ${guvernanta.quiz[0].question.trim()}`,
    });
    expect(result.rows[perDimension - 1]).toMatchObject({
      kind: "comment",
      label: "Argumentare",
    });
    expect(result.rows[perDimension].label).toBe(`2. ${financiar.name}`);
  });

  it("writes points as text out of the maximum", () => {
    expect(row(`1. ${guvernanta.name}`).values).toEqual([
      "25/25",
      "20/25",
      "3/25 (ciornă)",
      "5/25",
      "10/25",
    ]);
    expect(row(`1.1. ${guvernanta.quiz[0].question.trim()}`).values).toEqual([
      "5/5",
      "4/5",
      "3/5",
      "1/5",
      "2/5",
    ]);
    expect(result.rows[guvernanta.quiz.length + 1].values).toEqual([
      `argument ${guvernanta.key}`,
      "doar prima",
      "în lucru",
      `argument ${guvernanta.key}`,
      `argument ${guvernanta.key}`,
    ]);
  });

  it("shows a draft's answers so far, flagged on the dimension row", () => {
    expect(row(`2. ${financiar.name}`).values[1]).toBe("4/25 (ciornă)");
    expect(row(`2.1. ${financiar.quiz[0].question.trim()}`).values[1]).toBe("2/5");
    expect(row(`2.3. ${financiar.quiz[2].question.trim()}`).values[1]).toBeNull();
    // No argument written yet: left empty rather than "—".
    expect(result.rows[2 * (guvernanta.quiz.length + 2) - 1].values[1]).toBeNull();
  });

  it("leaves dimensions never opened empty", () => {
    expect(row(`2. ${financiar.name}`).values[2]).toBeNull();
  });
});
