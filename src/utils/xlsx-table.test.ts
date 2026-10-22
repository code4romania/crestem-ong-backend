import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  DATA_ROW_HEIGHT,
  DATE_FORMAT,
  PERCENT_FORMAT,
  renderTableWorkbook,
} from "./xlsx-table";

const readBack = async () => {
  const buffer = await renderTableWorkbook({
    sheetName: "Organizații",
    columns: [
      { header: "Nume", width: 30 },
      { header: "Dată", width: 12, type: "date" },
      { header: "Nr.", width: 8, type: "number" },
      { header: "Listă", width: 30, wrap: true },
    ],
    rows: [
      ["Asociația A", "2025-07-03", 4, "Ion: Guvernanță\nMaria: Leadership"],
      ["Asociația B", "—", 0, "1/2"],
    ],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook.getWorksheet("Organizații")!;
};

describe("renderTableWorkbook", () => {
  it("writes a bold, filterable header row", async () => {
    const sheet = await readBack();
    expect(sheet.getRow(1).values).toEqual([, "Nume", "Dată", "Nr.", "Listă"]);
    expect(sheet.getCell("A1").font?.bold).toBe(true);
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("turns calendar days into real dates on the same day", async () => {
    const cell = (await readBack()).getCell("B2");
    expect(cell.type).toBe(ExcelJS.ValueType.Date);
    expect((cell.value as Date).toISOString()).toBe("2025-07-03T00:00:00.000Z");
    expect(cell.numFmt).toBe(DATE_FORMAT);
  });

  it("keeps every record row one line tall, multi-line cells included", async () => {
    const sheet = await readBack();
    expect(sheet.getRow(2).height).toBe(DATA_ROW_HEIGHT);
    expect(sheet.getRow(3).height).toBe(DATA_ROW_HEIGHT);
  });

  it("keeps a placeholder in a date column as text", async () => {
    expect((await readBack()).getCell("B3").value).toBe("—");
  });

  it("turns 0–100 into a formatted percentage, keeping placeholders as text", async () => {
    const buffer = await renderTableWorkbook({
      sheetName: "Runde",
      columns: [{ header: "Scor (%)", width: 10, type: "percent" }],
      rows: [[72.5], ["—"]],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet("Runde")!;
    expect(sheet.getCell("A2").value).toBe(0.725);
    expect(sheet.getCell("A2").numFmt).toBe(PERCENT_FORMAT);
    expect(sheet.getCell("A3").value).toBe("—");
  });

  it("nests grouped rows under the row above them", async () => {
    const buffer = await renderTableWorkbook({
      sheetName: "Runde",
      columns: [{ header: "ID", width: 10 }],
      rows: [["r1"], { cells: ["e1"], outlineLevel: 1 }, ["r2"]],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet("Runde")!;
    expect(sheet.getCell("A3").value).toBe("e1");
    expect(sheet.getRow(2).outlineLevel ?? 0).toBe(0);
    expect(sheet.getRow(3).outlineLevel).toBe(1);
    expect(sheet.getRow(4).outlineLevel ?? 0).toBe(0);
    expect(sheet.getRow(3).height).toBe(DATA_ROW_HEIGHT);
  });

  it("writes links as clickable cells", async () => {
    const buffer = await renderTableWorkbook({
      sheetName: "Jurnal",
      columns: [{ header: "Raport", width: 20 }],
      rows: [[{ text: "raport.pdf", url: "https://cdn.example/raport.pdf" }], ["—"]],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet("Jurnal")!;
    expect(sheet.getCell("A2").value).toEqual({
      text: "raport.pdf",
      hyperlink: "https://cdn.example/raport.pdf",
    });
    expect(sheet.getCell("A2").font?.underline).toBe(true);
    expect(sheet.getCell("A3").value).toBe("—");
  });

  it("keeps numbers numeric and slashes as text", async () => {
    const sheet = await readBack();
    expect(sheet.getCell("C2").value).toBe(4);
    expect(sheet.getCell("C3").value).toBe(0);
    expect(sheet.getCell("D3").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("D2").value).toBe("Ion: Guvernanță\nMaria: Leadership");
  });
});
