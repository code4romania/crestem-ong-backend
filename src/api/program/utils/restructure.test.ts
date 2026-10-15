import { describe, expect, it } from "vitest";
import {
  isCandidate,
  normalizeCui,
  placeReport,
  resolveMembers,
  type RestructureProgram,
} from "./restructure";

const program = (
  name: string,
  phases: [string, string, string][],
  cuis: string[] = [],
): RestructureProgram => ({
  name,
  startDate: "2025-01-01",
  endDate: "2027-12-31",
  phases: phases.map(([title, startDate, endDate]) => ({
    title,
    startDate,
    endDate,
  })),
  ongs: cuis.map((cui) => ({ cui, name: `ONG ${cui}` })),
});

describe("normalizeCui", () => {
  it("drops the RO prefix and whitespace", () => {
    expect(normalizeCui(" RO 13705208 ")).toBe("13705208");
    expect(normalizeCui("ro13705208")).toBe("13705208");
  });

  it("leaves a plain code alone", () => {
    expect(normalizeCui("35210838")).toBe("35210838");
  });

  it("turns a missing code into an empty string", () => {
    expect(normalizeCui(null)).toBe("");
  });
});

describe("resolveMembers", () => {
  const ongs = [
    { documentId: "a", cui: "RO111" },
    { documentId: "b", cui: "222" },
    { documentId: "c1", cui: "RO333" },
    { documentId: "c2", cui: "333" },
  ];

  it("matches by normalized fiscal code", () => {
    const { members, skipped } = resolveMembers(
      [program("P", [], ["111", "RO222"])],
      ongs,
    );
    expect(members.get("P")).toEqual(["a", "b"]);
    expect(skipped).toEqual([]);
  });

  it("skips a code that matches nothing", () => {
    const { members, skipped } = resolveMembers(
      [program("P", [], ["999"])],
      ongs,
    );
    expect(members.get("P")).toEqual([]);
    expect(skipped).toEqual([
      { program: "P", name: "ONG 999", cui: "999", reason: "CUI negăsit în DB" },
    ]);
  });

  it("skips a code shared by two organizations", () => {
    const { members, skipped } = resolveMembers(
      [program("P", [], ["333"])],
      ongs,
    );
    expect(members.get("P")).toEqual([]);
    expect(skipped[0].reason).toBe("CUI ambiguu: 2 ONG-uri cu acest CUI");
  });

  it("lists an organization once even if the sheet repeats it", () => {
    const { members } = resolveMembers(
      [program("P", [], ["111", "RO111"])],
      ongs,
    );
    expect(members.get("P")).toEqual(["a"]);
  });
});

describe("placeReport", () => {
  const programs = [
    program("Gen1", [
      ["Etapa inițială", "2026-08-12", "2026-08-31"],
      ["Etapa finală", "2026-10-08", "2026-10-26"],
    ]),
    program("Gen2", [["Etapa inițială", "2026-08-01", "2026-09-30"]]),
  ];
  const members = new Map([
    ["Gen1", ["both", "gen1"]],
    ["Gen2", ["both"]],
  ]);

  it("places a report in the phase holding its creation day", () => {
    expect(
      placeReport(
        { ongDocumentId: "gen1", createdDate: "2026-10-08" },
        programs,
        members,
      ),
    ).toEqual([{ program: "Gen1", phase: "Etapa finală" }]);
  });

  it("includes both ends of the window", () => {
    expect(
      placeReport(
        { ongDocumentId: "gen1", createdDate: "2026-08-31" },
        programs,
        members,
      ),
    ).toEqual([{ program: "Gen1", phase: "Etapa inițială" }]);
  });

  it("places a report in every overlapping program its organization is in", () => {
    expect(
      placeReport(
        { ongDocumentId: "both", createdDate: "2026-08-18" },
        programs,
        members,
      ),
    ).toEqual([
      { program: "Gen1", phase: "Etapa inițială" },
      { program: "Gen2", phase: "Etapa inițială" },
    ]);
  });

  it("ignores programs the organization is not listed in", () => {
    expect(
      placeReport(
        { ongDocumentId: "gen1", createdDate: "2026-09-15" },
        programs,
        members,
      ),
    ).toEqual([]);
  });

  it("leaves a report outside every window unplaced", () => {
    expect(
      placeReport(
        { ongDocumentId: "both", createdDate: "2026-10-07" },
        programs,
        members,
      ),
    ).toEqual([]);
  });
});

describe("isCandidate", () => {
  it("takes an independent report", () => {
    expect(isCandidate([], ["old"])).toBe(true);
  });

  it("takes a report in a program being replaced", () => {
    expect(isCandidate(["old", "other"], ["old"])).toBe(true);
  });

  it("leaves a report that only sits in other programs", () => {
    expect(isCandidate(["other"], ["old"])).toBe(false);
  });
});
