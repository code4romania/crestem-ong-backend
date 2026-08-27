import { describe, expect, it } from "vitest";
import {
  phaseEndedForUnfinishedReport,
  phaseEvaluationsView,
  phaseOfSameProgram,
  programOfReport,
  resolvePickPhase,
} from "./association";

const TODAY = "2026-08-26";

const phase = (overrides: Partial<Record<string, unknown>> = {}) => ({
  documentId: "phase-1",
  title: "Faza 1",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  hasEvaluation: true,
  ...overrides,
});

const program = (phases: any[]) => ({
  documentId: "program-1",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  phases,
});

const report = (overrides: Partial<Record<string, unknown>> = {}) => ({
  documentId: "report-1",
  name: "Evaluare 1",
  ong: { documentId: "ong-1" },
  phases: [],
  ...overrides,
});

describe("resolvePickPhase", () => {
  it("resolves the explicitly chosen phase when it belongs to the program and accepts evaluation", () => {
    const target = phase({ documentId: "phase-2", title: "Faza 2" });
    const result = resolvePickPhase(
      program([phase(), target]),
      "phase-2",
      TODAY,
      "ONG Test",
    );
    expect(result).toEqual({ phase: target });
  });

  it("errors when the chosen phase does not belong to the program", () => {
    const result = resolvePickPhase(
      program([phase()]),
      "not-in-program",
      TODAY,
      "ONG Test",
    );
    expect(result).toEqual({
      error: "Faza selectată nu aparține acestui program pentru organizația ONG Test",
    });
  });

  it("errors when the chosen phase does not accept evaluation", () => {
    const target = phase({ documentId: "phase-2", title: "Faza 2", hasEvaluation: false });
    const result = resolvePickPhase(
      program([phase(), target]),
      "phase-2",
      TODAY,
      "ONG Test",
    );
    expect(result).toEqual({
      error: "Faza Faza 2 nu necesită evaluare pentru organizația ONG Test",
    });
  });

  it("falls back to the entry phase when no phase is chosen", () => {
    const upcoming = phase({
      documentId: "phase-2",
      title: "Faza viitoare",
      startDate: "2026-09-01",
      endDate: "2026-10-01",
    });
    const result = resolvePickPhase(
      program([phase({ endDate: "2026-08-01" }), upcoming]),
      undefined,
      TODAY,
      "ONG Test",
    );
    expect(result).toEqual({ phase: upcoming });
  });

  it("errors when no phase is chosen and the program has no entry phase", () => {
    const result = resolvePickPhase(
      program([phase({ hasEvaluation: false })]),
      undefined,
      TODAY,
      "ONG Test",
    );
    expect(result).toEqual({
      error: "Programul nu are o fază care să accepte evaluare",
    });
  });
});

describe("phaseEvaluationsView", () => {
  it("lists every evaluation phase, marking which one holds the ong's report", () => {
    const phase1 = phase({ documentId: "phase-1", title: "Faza 1" });
    const phase2 = phase({
      documentId: "phase-2",
      title: "Faza 2",
      startDate: "2026-02-01",
      endDate: "2026-03-01",
    });
    const prog = program([phase1, phase2]);
    const linkedReport = report({
      documentId: "report-1",
      name: "Evaluare X",
      ong: { documentId: "ong-1" },
      phases: [{ documentId: "phase-2", program: { documentId: "program-1" } }],
    });

    expect(phaseEvaluationsView(prog, "ong-1", [linkedReport])).toEqual([
      { phaseDocumentId: "phase-1", phaseTitle: "Faza 1", report: null },
      {
        phaseDocumentId: "phase-2",
        phaseTitle: "Faza 2",
        report: { documentId: "report-1", name: "Evaluare X" },
      },
    ]);
  });

  it("ignores reports belonging to a different ong", () => {
    const prog = program([phase()]);
    const otherOngReport = report({
      ong: { documentId: "ong-2" },
      phases: [{ documentId: "phase-1", program: { documentId: "program-1" } }],
    });

    expect(phaseEvaluationsView(prog, "ong-1", [otherOngReport])).toEqual([
      { phaseDocumentId: "phase-1", phaseTitle: "Faza 1", report: null },
    ]);
  });

  it("excludes phases that don't accept evaluation", () => {
    const evalPhase = phase({ documentId: "phase-1", title: "Faza 1" });
    const nonEvalPhase = phase({
      documentId: "phase-2",
      title: "Faza 2",
      hasEvaluation: false,
    });
    const prog = program([evalPhase, nonEvalPhase]);

    expect(phaseEvaluationsView(prog, "ong-1", [])).toEqual([
      { phaseDocumentId: "phase-1", phaseTitle: "Faza 1", report: null },
    ]);
  });
});

describe("phaseOfSameProgram", () => {
  it("finds the phase belonging to the given program", () => {
    const target = { documentId: "phase-2", program: { documentId: "program-1" } };
    const linkedReport = report({
      phases: [{ documentId: "phase-1", program: { documentId: "program-2" } }, target],
    });
    expect(phaseOfSameProgram(linkedReport, "program-1")).toEqual(target);
  });

  it("returns null when no phase belongs to the given program", () => {
    const linkedReport = report({
      phases: [{ documentId: "phase-1", program: { documentId: "program-2" } }],
    });
    expect(phaseOfSameProgram(linkedReport, "program-1")).toBeNull();
  });
});

describe("programOfReport", () => {
  it("returns the program of the report's first phase that has one", () => {
    const linkedReport = report({
      phases: [
        { documentId: "phase-1", program: null },
        { documentId: "phase-2", program: { documentId: "program-1", name: "Program 1" } },
      ],
    });
    expect(programOfReport(linkedReport)).toEqual({ documentId: "program-1", name: "Program 1" });
  });

  it("returns null when the report has no phases with a program", () => {
    expect(programOfReport(report({ phases: [] }))).toBeNull();
  });
});

describe("phaseEndedForUnfinishedReport", () => {
  it("is true for an ended phase and an unfinished report", () => {
    expect(
      phaseEndedForUnfinishedReport(
        phase({ endDate: "2026-08-01" }),
        { finished: false },
        TODAY,
      ),
    ).toBe(true);
  });

  it("is false for an ended phase when the report is finished", () => {
    expect(
      phaseEndedForUnfinishedReport(
        phase({ endDate: "2026-08-01" }),
        { finished: true },
        TODAY,
      ),
    ).toBe(false);
  });

  it("is false for a phase that has not ended yet", () => {
    expect(
      phaseEndedForUnfinishedReport(
        phase({ endDate: "2026-12-31" }),
        { finished: false },
        TODAY,
      ),
    ).toBe(false);
  });
});
