import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../../constants/dimensions";
import {
  buildOngListExport,
  lastEvaluationDay,
  ONG_LIST_COLUMNS,
} from "./list-export";

const TODAY = "2026-10-20";
const column = (header: string) =>
  ONG_LIST_COLUMNS.findIndex((c) => c.header === header);

const allSubmitted = () =>
  DIMENSIONS.map((dimension) => ({
    dimensionKey: dimension.key,
    submitted: true,
  }));

const ong = (overrides: Record<string, unknown> = {}) => ({
  documentId: "ong-1",
  cui: "RO123",
  name: "Asociația A",
  ngoStatus: "active",
  createdAt: "2025-07-02T22:30:00.000Z",
  programs: [
    { documentId: "p1", name: "SCA" },
    { documentId: "p2", name: "BRD HUB START" },
  ],
  judet: { nume: "București" },
  localitate: { nume: "Sectorul 1" },
  domeniuPrincipal: { name: "Educație" },
  domeniuSecundar: null,
  website: "https://a.ro",
  socialMedia: "  ",
  ...overrides,
});

const closedRound = {
  finished: true,
  finishedAt: "2026-03-10T09:00:00.000Z",
  phases: [],
  evaluations: [{ dimensions: allSubmitted() }, { dimensions: [] }],
};
// Program round whose only phase ended: closed with no `finishedAt`.
const autoClosedRound = {
  finished: false,
  finishedAt: null,
  phases: [{ endDate: "2026-05-31" }],
  evaluations: [{ dimensions: allSubmitted() }],
};
const runningRound = {
  finished: false,
  finishedAt: null,
  phases: [],
  evaluations: [{ dimensions: allSubmitted() }, { dimensions: [] }],
};

const build = (overrides: Partial<Parameters<typeof buildOngListExport>[0]> = {}) =>
  buildOngListExport({
    ongs: [ong()],
    members: new Map([
      [
        "ong-1",
        {
          admin: { nume: "Ana Pop", email: "ana@a.ro", telefon: "0722" },
          memberCount: 3,
        },
      ],
    ]),
    reportsByOng: new Map([["ong-1", [closedRound, autoClosedRound, runningRound]]]),
    mentorsByOng: new Map([
      [
        "ong-1",
        [
          { nume: "Ion Mentor", dimensiuni: ["leadership", "guvernanta"] },
          { nume: "Maria Mentor", dimensiuni: [] },
        ],
      ],
    ]),
    today: TODAY,
    ...overrides,
  });

describe("buildOngListExport", () => {
  it("has the model's columns and a dated file name", () => {
    const result = build();
    expect(ONG_LIST_COLUMNS).toHaveLength(19);
    expect(result.fileName).toBe("organizatii-2026-10-20.xlsx");
    expect(result.rows[0]).toHaveLength(19);
  });

  it("fills one row per organization", () => {
    const row = build().rows[0];
    expect(row[column("CIF")]).toBe("RO123");
    expect(row[column("Nume Organizație")]).toBe("Asociația A");
    expect(row[column("Program(e)")]).toBe("SCA, BRD HUB START");
    // 22:30 UTC on 2 July is already 3 July in Bucharest.
    expect(row[column("Dată înregistrare")]).toBe("2025-07-03");
    expect(row[column("Nr. Evaluari")]).toBe(3);
    // One complete respondent in each of the three rounds.
    expect(row[column("Nr. matrici completate")]).toBe(3);
    expect(row[column("Nr. membri organizație")]).toBe(3);
    expect(row[column("Nume Admin")]).toBe("Ana Pop");
    expect(row[column("Email Admin")]).toBe("ana@a.ro");
    expect(row[column("Telefon")]).toBe("0722");
    expect(row[column("Județ")]).toBe("București");
    expect(row[column("Localitate")]).toBe("Sectorul 1");
    expect(row[column("Domeniu principal")]).toBe("Educație");
    expect(row[column("Domeniu secundar")]).toBe("—");
    expect(row[column("Website")]).toBe("https://a.ro");
    expect(row[column("Social Media")]).toBe("—");
  });

  it("dates the last evaluation by the latest closed round", () => {
    // The auto-closed round (31 May) is later than the finished one (10 March).
    expect(build().rows[0][column("Ultima evaluare")]).toBe("2026-05-31");
  });

  it("names each mentor in front of their specializations, one per line", () => {
    const row = build().rows[0];
    expect(row[column("Persoana(e) resursa alocata(e)")]).toBe(
      "Ion Mentor, Maria Mentor",
    );
    // Catalog order, not the order the mentor picked them in.
    expect(row[column("Specializare pe dimensiuni (Mentor)")]).toBe(
      "Ion Mentor: Guvernanță, Leadership\nMaria Mentor: —",
    );
  });

  it("shows only the filtered program", () => {
    const row = build({ program: "p2" }).rows[0];
    expect(row[column("Program(e)")]).toBe("BRD HUB START");
  });

  it("marks a retired organization", () => {
    const row = build({ ongs: [ong({ ngoStatus: "deleted" })] }).rows[0];
    expect(row[column("Nume Organizație")]).toBe("Asociația A (Retras)");
  });

  it("fills an organization with nothing linked with placeholders", () => {
    const row = build({
      ongs: [ong({ documentId: "ong-2", programs: [] })],
    }).rows[0];
    expect(row[column("Program(e)")]).toBe("—");
    expect(row[column("Ultima evaluare")]).toBe("—");
    expect(row[column("Nr. Evaluari")]).toBe(0);
    expect(row[column("Nr. matrici completate")]).toBe(0);
    expect(row[column("Nr. membri organizație")]).toBe(0);
    expect(row[column("Nume Admin")]).toBe("—");
    expect(row[column("Persoana(e) resursa alocata(e)")]).toBe("—");
    expect(row[column("Specializare pe dimensiuni (Mentor)")]).toBe("—");
  });
});

describe("lastEvaluationDay", () => {
  it("ignores rounds still running", () => {
    expect(lastEvaluationDay([runningRound], TODAY)).toBeNull();
  });

  it("reads a finished round's datetime as its Bucharest day", () => {
    expect(
      lastEvaluationDay(
        [{ ...closedRound, finishedAt: "2026-03-10T22:30:00.000Z" }],
        TODAY,
      ),
    ).toBe("2026-03-11");
  });
});
