import { describe, expect, it } from "vitest";
import { optionScope } from "./filter-scope";

const phase = (programName: string | null) => ({
  program: programName
    ? { documentId: `program-${programName}`, name: programName }
    : null,
});

const report = (overrides: Record<string, any> = {}) => ({
  documentId: "report-1",
  ong: { documentId: "ong-1" },
  phases: [],
  ...overrides,
});

describe("optionScope", () => {
  it("keeps the organizations that ran a round", () => {
    const scope = optionScope(
      [
        report({ ong: { documentId: "ong-1" } }),
        report({ documentId: "report-2", ong: { documentId: "ong-2" } }),
      ],
      "reports",
    );

    expect([...scope.ongs].sort()).toEqual(["ong-1", "ong-2"]);
  });

  it("lists an organization once, however many rounds it ran", () => {
    const scope = optionScope([report(), report({ documentId: "report-2" })], "reports");

    expect([...scope.ongs]).toEqual(["ong-1"]);
  });

  it("keeps the programs the rounds belong to", () => {
    const scope = optionScope(
      [report({ phases: [phase("Acceleratorul"), phase("Acceleratorul")] })],
      "reports",
    );

    expect([...scope.programs]).toEqual(["program-Acceleratorul"]);
  });

  it("reports whether any round sits outside every program", () => {
    expect(optionScope([report()], "reports").hasIndependent).toBe(true);
    expect(
      optionScope([report({ phases: [phase("Acceleratorul")] })], "reports")
        .hasIndependent,
    ).toBe(false);
  });

  it("ignores the rounds nobody was invited to when the responses are what is listed", () => {
    // Which rounds have a response is a separate, flat query — hydrating every
    // response of every round only to ask whether there is one is what made this
    // list expensive.
    const scope = optionScope(
      [
        report({
          ong: { documentId: "ong-empty" },
          phases: [phase("Acceleratorul")],
        }),
        report({
          documentId: "report-2",
          ong: { documentId: "ong-answered" },
          phases: [phase("Mentorat")],
        }),
      ],
      "evaluations",
      new Set(["report-2"]),
    );

    expect([...scope.ongs]).toEqual(["ong-answered"]);
    expect([...scope.programs]).toEqual(["program-Mentorat"]);
  });

  it("has no options at all when no round has a response yet", () => {
    const scope = optionScope([report()], "evaluations", new Set());

    expect(scope.ongs.size).toBe(0);
    expect(scope.hasIndependent).toBe(false);
  });

  it("keeps a round with no responses when the rounds themselves are what is listed", () => {
    const scope = optionScope(
      [report({ ong: { documentId: "ong-empty" } })],
      "reports",
    );

    expect([...scope.ongs]).toEqual(["ong-empty"]);
  });

  it("survives a round whose organization is gone", () => {
    const scope = optionScope([report({ ong: null })], "reports");

    expect(scope.ongs.size).toBe(0);
  });
});
