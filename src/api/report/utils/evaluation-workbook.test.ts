import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { EvaluationExport } from "./evaluation-export";
import {
  GENERAL_SHEET,
  RESPONDENTS_SHEET,
  renderEvaluationWorkbook,
} from "./evaluation-workbook";

const data: EvaluationExport = {
  fileName: "evaluare-ong-2026-03-02.xlsx",
  general: [
    { label: "ID:", value: "round-1" },
    { label: "Scor obținut", value: { percent: 72.5 } },
    { label: "Număr completări", value: "5/7" },
  ],
  dimensions: [
    {
      name: "Guvernanță",
      value: { percent: 90 },
      indicators: [
        { name: "Viziune și misiune", value: { percent: 100 } },
        { name: "Plan strategic", value: { percent: 80 } },
      ],
    },
    {
      name: "Aspecte financiare",
      value: "—",
      indicators: [{ name: "Legislație", value: "—" }],
    },
  ],
  respondents: [
    { label: "Evaluator 1", email: "a@x.ro" },
    { label: "Evaluator 2", email: "b@x.ro" },
  ],
  rows: [
    { kind: "dimension", label: "1. Guvernanță", values: ["24/25", null] },
    { kind: "question", label: "1.1. Întrebare?", values: ["4/5", null] },
    { kind: "comment", label: "Argumentare", values: ["text lung", null] },
  ],
};

const readBack = async () => {
  const buffer = await renderEvaluationWorkbook(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook;
};

describe("renderEvaluationWorkbook", () => {
  it("writes the two sheets of the model, in order", async () => {
    const workbook = await readBack();
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      GENERAL_SHEET,
      RESPONDENTS_SHEET,
    ]);
  });

  it("lays out Date Generale with real percentages", async () => {
    const sheet = (await readBack()).getWorksheet(GENERAL_SHEET)!;
    expect(sheet.getCell("A1").value).toBe("Date Generale");
    expect(sheet.getCell("A2").value).toBe("ID:");
    expect(sheet.getCell("B2").value).toBe("round-1");
    expect(sheet.getCell("B3").value).toBe(0.725);
    expect(sheet.getCell("B3").numFmt).toBe("0.0%");
    expect(sheet.getCell("B4").value).toBe("5/7");
    // A blank row, then the per-dimension block.
    expect(sheet.getCell("A6").value).toBe("Rezultate Generale pe dimensiuni");
    expect(sheet.getCell("A7").value).toBe("Guvernanță");
    expect(sheet.getCell("A7").font?.bold).toBe(true);
    expect(sheet.getCell("B7").value).toBe(0.9);
    // Indicators follow their dimension, indented.
    expect(sheet.getCell("A8").value).toBe("Viziune și misiune");
    expect(sheet.getCell("A8").alignment?.indent).toBe(2);
    expect(sheet.getCell("B8").value).toBe(1);
    expect(sheet.getCell("B8").numFmt).toBe("0.0%");
    expect(sheet.getCell("A9").value).toBe("Plan strategic");
    expect(sheet.getCell("A10").value).toBe("Aspecte financiare");
    expect(sheet.getCell("B10").value).toBe("—");
    expect(sheet.getCell("A11").value).toBe("Legislație");
  });

  it("keeps points as text so Excel does not read them as dates", async () => {
    const sheet = (await readBack()).getWorksheet(RESPONDENTS_SHEET)!;
    expect(sheet.getCell("B3").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("B3").value).toBe("24/25");
    expect(sheet.getCell("B4").value).toBe("4/5");
    expect(sheet.getCell("B5").value).toBe("text lung");
    expect(sheet.getCell("C4").value).toBeNull();
  });

  it("puts respondents in columns under a merged title", async () => {
    const sheet = (await readBack()).getWorksheet(RESPONDENTS_SHEET)!;
    expect(sheet.getCell("A1").value).toBe(RESPONDENTS_SHEET);
    expect(sheet.getCell("A2").isMerged).toBe(true);
    expect(sheet.getCell("A2").master.address).toBe("A1");
    expect(sheet.getCell("B1").value).toBe("Evaluator 1");
    expect(sheet.getCell("C1").value).toBe("Evaluator 2");
    expect(sheet.getCell("B2").value).toBe("a@x.ro");
    expect(sheet.getCell("A3").value).toBe("1. Guvernanță");
    expect(sheet.getCell("A4").value).toBe("1.1. Întrebare?");
  });
});
