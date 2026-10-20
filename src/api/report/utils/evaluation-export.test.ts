import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../../constants/dimensions";
import { buildEvaluationExport, exportFileName } from "./evaluation-export";

const [guvernanta, financiar] = DIMENSIONS;

/** A respondent who submitted every dimension, all answers `answer`. */
const complete = (email: string, answer: number) => ({
  user: { email, accountStatus: "active" },
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
    expect(result.dimensions[0]).toEqual({
      name: guvernanta.name,
      value: { percent: 100 },
    });
    expect(result.dimensions[1]).toEqual({
      name: financiar.name,
      value: { percent: 0 },
    });
    expect(result.dimensions[2].value).toEqual({ percent: 50 });
  });
});

describe("buildEvaluationExport — Rezultate evaluări individuale", () => {
  const partial = {
    user: { email: "partial@x.ro", accountStatus: "active" },
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
        // A draft: answered but not submitted, so it stays out.
        dimensionKey: financiar.key,
        submitted: false,
        comment: "ciornă",
        quiz: financiar.quiz.map((question) => ({
          questionId: question.id,
          answer: 2,
        })),
      },
    ],
  };
  const deleted = {
    user: { email: "deleted-1@anon", accountStatus: "deleted" },
    dimensions: [],
  };

  const result = buildEvaluationExport({
    report: programRound([complete("full@x.ro", 5), partial, deleted]),
    closed: false,
    admin,
    mentorNames: [],
  });
  const row = (label: string) => result.rows.find((r) => r.label === label)!;

  it("has one column per invited respondent, whatever their status", () => {
    expect(result.respondents).toEqual([
      { label: "Evaluator 1", email: "full@x.ro" },
      { label: "Evaluator 2", email: "partial@x.ro" },
      { label: "Evaluator 3", email: "Cont șters" },
    ]);
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
    expect(row(`1. ${guvernanta.name}`).values).toEqual(["25/25", "20/25", null]);
    expect(
      row(`1.1. ${guvernanta.quiz[0].question.trim()}`).values,
    ).toEqual(["5/5", "4/5", null]);
    expect(result.rows[guvernanta.quiz.length + 1].values).toEqual([
      `argument ${guvernanta.key}`,
      "doar prima",
      null,
    ]);
  });

  it("leaves draft dimensions empty", () => {
    expect(row(`2. ${financiar.name}`).values).toEqual(["25/25", null, null]);
    expect(
      row(`2.1. ${financiar.quiz[0].question.trim()}`).values,
    ).toEqual(["5/5", null, null]);
  });
});
