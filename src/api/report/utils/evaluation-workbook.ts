import ExcelJS from "exceljs";
import type {
  EvaluationExport,
  GeneralValue,
  RespondentRowKind,
} from "./evaluation-export";

/**
 * Renders `buildEvaluationExport` into the two sheets of the client's model.
 * Points such as "4/5" go in as strings, so Excel keeps them as text instead of
 * reading them as dates; percentages go in as numbers with a `%` format.
 */

export const GENERAL_SHEET = "Date Generale";
export const RESPONDENTS_SHEET = "Rezultate evaluări individuale";

const PERCENT_FORMAT = "0.0%";
const SECTION_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2E8F0" },
};
const WRAP_TOP: Partial<ExcelJS.Alignment> = {
  wrapText: true,
  vertical: "top",
};

const setValue = (cell: ExcelJS.Cell, value: GeneralValue) => {
  if (typeof value === "string") {
    cell.value = value;
    return;
  }
  cell.value = value.percent / 100;
  cell.numFmt = PERCENT_FORMAT;
  cell.alignment = { horizontal: "left" };
};

const addGeneralSheet = (workbook: ExcelJS.Workbook, data: EvaluationExport) => {
  const sheet = workbook.addWorksheet(GENERAL_SHEET);
  sheet.columns = [{ width: 45 }, { width: 45 }];

  sheet.addRow([GENERAL_SHEET]).font = { bold: true, size: 12 };
  for (const row of data.general) {
    const added = sheet.addRow([row.label]);
    added.getCell(1).font = { bold: true };
    setValue(added.getCell(2), row.value);
  }

  sheet.addRow([]);
  sheet.addRow(["Rezultate Generale pe dimensiuni"]).font = {
    bold: true,
    size: 12,
  };
  for (const dimension of data.dimensions) {
    const added = sheet.addRow([dimension.name]);
    added.font = { bold: true };
    setValue(added.getCell(2), dimension.value);
    for (const indicator of dimension.indicators) {
      const row = sheet.addRow([indicator.name]);
      row.getCell(1).alignment = { indent: 2 };
      setValue(row.getCell(2), indicator.value);
    }
  }
};

const ROW_STYLE: Record<RespondentRowKind, (row: ExcelJS.Row) => void> = {
  dimension: (row) => {
    row.font = { bold: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = SECTION_FILL;
    });
  },
  question: (row) => {
    row.alignment = WRAP_TOP;
  },
  comment: (row) => {
    row.alignment = WRAP_TOP;
    row.getCell(1).font = { italic: true };
  },
};

const addRespondentsSheet = (
  workbook: ExcelJS.Workbook,
  data: EvaluationExport,
) => {
  const sheet = workbook.addWorksheet(RESPONDENTS_SHEET, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2 }],
  });
  const columnCount = 1 + data.respondents.length;
  sheet.columns = [
    { width: 70 },
    ...data.respondents.map(() => ({ width: 30 })),
  ];

  const header = sheet.addRow([
    RESPONDENTS_SHEET,
    ...data.respondents.map((respondent) => respondent.label),
  ]);
  const emails = sheet.addRow([
    null,
    ...data.respondents.map((respondent) => respondent.email),
  ]);
  sheet.mergeCells(1, 1, 2, 1);
  header.font = { bold: true };
  header.getCell(1).alignment = { vertical: "middle", wrapText: true };
  emails.font = { italic: true };

  for (const row of data.rows) {
    const added = sheet.addRow([row.label, ...row.values]);
    // `eachCell` with `includeEmpty` stops at the last filled cell, so pad the
    // row out to every respondent column before styling it.
    for (let column = 1; column <= columnCount; column += 1) {
      added.getCell(column);
    }
    ROW_STYLE[row.kind](added);
  }
};

export const renderEvaluationWorkbook = async (
  data: EvaluationExport,
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Creștem ONG";
  addGeneralSheet(workbook, data);
  addRespondentsSheet(workbook, data);
  return Buffer.from(await workbook.xlsx.writeBuffer());
};
