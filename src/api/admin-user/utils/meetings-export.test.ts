import { describe, expect, it } from "vitest";
import { MEETINGS_COLUMNS, meetingRow, meetingsFileName } from "./meetings-export";

const column = (header: string) => {
  const index = MEETINGS_COLUMNS.findIndex((c) => c.header === header);
  if (index < 0) throw new Error(`no column ${header}`);
  return index;
};

const BASE = "https://api.example";

const meeting = {
  // 07:30 UTC is 10:30 in Bucharest (UTC+3 in summer).
  dataOra: "2026-06-15T07:30:00.000Z",
  format: "fata_in_fata",
  status: "efectuata",
  subiect: " Discuție buget ",
  dimensiuni: ["aspecte_financiare", "guvernanta", "necunoscuta"],
  comentarii: "Am stabilit pașii.",
  ong: { name: "Asociația A", cui: "RO123", ngoStatus: "active" },
  mentor: { nume: "Ion Mentor", accountStatus: "active" },
  program: { name: "SCA1 - FDSC" },
  report: { url: "https://cdn.example/raport.pdf", name: "raport.pdf" },
};

describe("MEETINGS_COLUMNS", () => {
  it("follows the model, with the CIF and the resource person added", () => {
    expect(MEETINGS_COLUMNS.map((c) => c.header)).toEqual([
      "Organizația",
      "CIF",
      "Persoană resursă",
      "Program",
      "Subiect întâlnire",
      "Dată",
      "Ora",
      "Format",
      "Dimensiuni matrice",
      "Comentarii adiționale",
      "Raport încărcat",
    ]);
  });
});

describe("meetingRow", () => {
  const row = meetingRow(meeting, BASE);

  it("fills the organization, the person and the program", () => {
    expect(row).toHaveLength(MEETINGS_COLUMNS.length);
    expect(row[column("Organizația")]).toBe("Asociația A");
    expect(row[column("CIF")]).toBe("RO123");
    expect(row[column("Persoană resursă")]).toBe("Ion Mentor");
    expect(row[column("Program")]).toBe("SCA1 - FDSC");
    expect(row[column("Subiect întâlnire")]).toBe("Discuție buget");
  });

  it("splits the date and the hour in Bucharest time", () => {
    expect(row[column("Dată")]).toBe("2026-06-15");
    expect(row[column("Ora")]).toBe("10:30");
  });

  it("names the format and lists dimensions in the matrix's order", () => {
    expect(row[column("Format")]).toBe("Față în față");
    expect(row[column("Dimensiuni matrice")]).toBe("Guvernanță\nAspecte financiare");
  });

  it("links the uploaded report", () => {
    expect(row[column("Raport încărcat")]).toEqual({
      text: "raport.pdf",
      url: "https://cdn.example/raport.pdf",
    });
    const local = meetingRow(
      { ...meeting, report: { url: "/uploads/raport.pdf", name: "raport.pdf" } },
      BASE,
    );
    expect(local[column("Raport încărcat")]).toEqual({
      text: "raport.pdf",
      url: "https://api.example/uploads/raport.pdf",
    });
  });

  it("marks what is missing, deleted or retired", () => {
    const sparse = meetingRow(
      {
        ...meeting,
        format: "online",
        dimensiuni: [],
        comentarii: "",
        program: null,
        report: null,
        ong: { name: "Asociația B", cui: null, ngoStatus: "deleted" },
        mentor: { nume: "Anonim x", accountStatus: "deleted" },
      },
      BASE,
    );
    expect(sparse[column("Organizația")]).toBe("Asociația B (Retras)");
    expect(sparse[column("CIF")]).toBe("—");
    expect(sparse[column("Persoană resursă")]).toBe("Cont șters");
    expect(sparse[column("Program")]).toBe("—");
    expect(sparse[column("Format")]).toBe("Online");
    expect(sparse[column("Dimensiuni matrice")]).toBe("—");
    expect(sparse[column("Comentarii adiționale")]).toBe("—");
    expect(sparse[column("Raport încărcat")]).toBe("—");
  });
});

describe("meetingsFileName", () => {
  it("dates everyone's journal, and names one person's", () => {
    expect(meetingsFileName("2026-10-22")).toBe("jurnal-activitate-2026-10-22.xlsx");
    expect(meetingsFileName("2026-10-22", "Ioana Ștefănescu")).toBe(
      "jurnal-activitate-ioana-stefanescu-2026-10-22.xlsx",
    );
  });
});
