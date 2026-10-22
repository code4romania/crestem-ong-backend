import type ExcelJS from "exceljs";
import { toDateString, toDisplayDate } from "../../../utils/date";
import { DATE_FORMAT, startTableSheet } from "../../../utils/xlsx-table";
import { fileSlug } from "../../report/utils/evaluation-export";
import { PROGRAM_ROUNDS_COLUMNS } from "../../report/utils/rounds-export";

/**
 * "Descarcă evaluările" on a program's page, after the client's model
 * `4. Export Programe.xlsx`: the program's rounds, laid out like the rounds
 * export, then a sheet about the program itself.
 */

export const LIST_SHEET = "Lista";
export const PROGRAM_SHEET = "Program";

export interface ProgramSummary {
  name: string;
  startDate: string;
  endDate: string;
  /** Organizations in the program now, as the page's card counts them. */
  ongsCount: number;
  /** Respondents who completed every dimension, across the program's rounds. */
  completed: number;
  /** Everyone invited to those rounds. */
  invited: number;
  /**
   * Organizations whose rounds in the program have all closed, as the page's
   * "ONG-uri cu evaluare finalizată" card counts them.
   */
  finalizedEvaluation: number;
  /** Resource persons, without deleted accounts, as the page's card counts them. */
  mentorsCount: number;
  phases: { title: string; startDate: string; endDate: string; hasEvaluation: boolean }[];
}

const SUMMARY_HEADERS = [
  "Denumire program",
  "Data de început",
  "Data de final",
  "Nr. ONG-uri înscrise în program",
  "Nr matrici completate",
  "Nr. evaluări finalizate",
  "Nr. Persoane Resursă",
];

const PHASE_HEADERS = ["Titlu fază", "Perioadă desfășurare", "Evaluare"];

/** Midnight UTC, so exceljs writes the same calendar day whatever the server's zone. */
const excelDate = (value: string) => new Date(`${toDateString(value)}T00:00:00.000Z`);

/** `program-<nume-program>-<YYYY-MM-DD>.xlsx`, dated by the download day. */
export const programExportFileName = (programName: string, today: string) =>
  `program-${fileSlug(programName, "program")}-${today}.xlsx`;

/** The "Lista" sheet, for the controller to fill with `addTableRow`. */
export const startListSheet = (workbook: ExcelJS.Workbook) =>
  startTableSheet(workbook, { sheetName: LIST_SHEET, columns: PROGRAM_ROUNDS_COLUMNS });

/**
 * The "Program" sheet, after "Lista": its counts are tallied while the list
 * is written.
 */
export const addProgramSheet = (workbook: ExcelJS.Workbook, summary: ProgramSummary) => {
  const sheet = workbook.addWorksheet(PROGRAM_SHEET);
  sheet.columns = [30, 24, 16, 16, 16, 16, 16].map((width) => ({ width }));

  const header = sheet.addRow(SUMMARY_HEADERS);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };
  const values = sheet.addRow([
    summary.name,
    excelDate(summary.startDate),
    excelDate(summary.endDate),
    summary.ongsCount,
    // Text, so Excel does not read it as a date.
    `${summary.completed}/${summary.invited}`,
    summary.finalizedEvaluation,
    summary.mentorsCount,
  ]);
  values.alignment = { horizontal: "left", vertical: "top" };
  for (const column of [2, 3]) {
    values.getCell(column).numFmt = DATE_FORMAT;
  }

  sheet.addRow([]);
  const section = sheet.addRow(["Faze program"]);
  section.font = { bold: true };
  sheet.mergeCells(section.number, 1, section.number, PHASE_HEADERS.length);
  sheet.addRow(PHASE_HEADERS).font = { bold: true };
  for (const phase of [...summary.phases].sort((a, b) =>
    `${a.startDate}`.localeCompare(`${b.startDate}`),
  )) {
    sheet.addRow([
      phase.title,
      `${toDisplayDate(phase.startDate)} – ${toDisplayDate(phase.endDate)}`,
      phase.hasEvaluation ? "Da" : "Nu",
    ]);
  }
  sheet.commit();
};
