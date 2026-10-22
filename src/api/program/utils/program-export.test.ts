import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buffer as readAll } from "stream/consumers";
import { DATE_FORMAT, addTableRow, streamWorkbook } from "../../../utils/xlsx-table";
import { PROGRAM_ROUNDS_COLUMNS } from "../../report/utils/rounds-export";
import {
  LIST_SHEET,
  PROGRAM_SHEET,
  addProgramSheet,
  programExportFileName,
  startListSheet,
} from "./program-export";

/** Written the way the controller streams it. */
const readBack = async () => {
  const row = PROGRAM_ROUNDS_COLUMNS.map(() => null);
  const stream = streamWorkbook(async (workbook) => {
    const list = startListSheet(workbook);
    addTableRow(list, PROGRAM_ROUNDS_COLUMNS, ["round-1", ...row.slice(1)]);
    addTableRow(list, PROGRAM_ROUNDS_COLUMNS, {
      cells: ["eval-1", ...row.slice(1)],
      outlineLevel: 1,
    });
    list.commit();
    addProgramSheet(workbook, {
      name: "SCA-FDSC2",
      startDate: "2025-03-21",
      endDate: "2025-12-31",
      ongsCount: 35,
      completed: 100,
      invited: 140,
      finalizedEvaluation: 12,
      mentorsCount: 20,
      phases: [
        { title: "Faza finală", startDate: "2025-09-01", endDate: "2025-12-31", hasEvaluation: false },
        { title: "Faza inițială", startDate: "2025-03-21", endDate: "2025-06-30", hasEvaluation: true },
      ],
    });
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await readAll(stream)) as any);
  return workbook;
};

describe("program workbook", () => {
  it("lists the rounds first, respondents grouped under them", async () => {
    const workbook = await readBack();
    expect(workbook.worksheets.map((s) => s.name)).toEqual([LIST_SHEET, PROGRAM_SHEET]);
    const list = workbook.getWorksheet(LIST_SHEET)!;
    expect(list.getCell("A1").value).toBe("ID evaluare");
    expect(list.getCell("A2").value).toBe("round-1");
    expect(list.getRow(3).outlineLevel).toBe(1);
  });

  it("describes the program like the model", async () => {
    const sheet = (await readBack()).getWorksheet(PROGRAM_SHEET)!;
    expect(sheet.getRow(1).values).toEqual([
      ,
      "Denumire program",
      "Data de început",
      "Data de final",
      "Nr. ONG-uri înscrise în program",
      "Nr matrici completate",
      "Nr. evaluări finalizate",
      "Nr. Persoane Resursă",
    ]);
    expect(sheet.getCell("A2").value).toBe("SCA-FDSC2");
    expect((sheet.getCell("B2").value as Date).toISOString()).toBe("2025-03-21T00:00:00.000Z");
    expect(sheet.getCell("B2").numFmt).toBe(DATE_FORMAT);
    expect(sheet.getCell("D2").value).toBe(35);
    expect(sheet.getCell("E2").value).toBe("100/140");
    // The page's "ONG-uri cu evaluare finalizată" card, not the respondents.
    expect(sheet.getCell("F2").value).toBe(12);
    expect(sheet.getCell("G2").value).toBe(20);
  });

  it("lists the phases by start date under a merged title", async () => {
    const sheet = (await readBack()).getWorksheet(PROGRAM_SHEET)!;
    expect(sheet.getCell("A4").value).toBe("Faze program");
    expect(sheet.getCell("C4").isMerged).toBe(true);
    expect(sheet.getRow(5).values).toEqual([, "Titlu fază", "Perioadă desfășurare", "Evaluare"]);
    expect(sheet.getRow(6).values).toEqual([, "Faza inițială", "21.03.2025 – 30.06.2025", "Da"]);
    expect(sheet.getRow(7).values).toEqual([, "Faza finală", "01.09.2025 – 31.12.2025", "Nu"]);
  });
});

describe("programExportFileName", () => {
  it("names the file after the program and the download day", () => {
    expect(programExportFileName("SCA1 - FDSC Brașov", "2026-10-21")).toBe(
      "program-sca1-fdsc-brasov-2026-10-21.xlsx",
    );
  });
});
