import ExcelJS from "exceljs";

/**
 * A one-sheet table export: bold header row, frozen and filterable, one row per
 * record. The FDSC list exports share it; the per-round evaluation export has
 * its own two-sheet layout in `report/utils/evaluation-workbook.ts`.
 */

export type TableColumnType = "text" | "number" | "date" | "percent";

export interface TableColumn {
  header: string;
  width: number;
  /**
   * `date` cells take a `YYYY-MM-DD` calendar day and become real Excel dates;
   * `percent` cells take 0–100 and become fractions with a `%` format. Any
   * other string in either (e.g. "—") is written as text.
   */
  type?: TableColumnType;
  /** Multi-line cells, e.g. one entry per line. */
  wrap?: boolean;
}

/** A clickable cell: `text` shows, `url` opens. */
export interface TableLink {
  text: string;
  url: string;
}

export type TableCell = string | number | null | TableLink;

const LINK_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FF0563C1" },
  underline: true,
};

/** A record row nested under the row above it, collapsible with Excel's +/−. */
export interface GroupedRow {
  cells: TableCell[];
  outlineLevel: number;
}

export type TableRow = TableCell[] | GroupedRow;

export interface TableExport {
  sheetName: string;
  columns: TableColumn[];
  rows: TableRow[];
}

/**
 * Every record row is one line tall, whatever its longest cell: a long argument
 * would otherwise make Excel stretch the row to fit it. Wrapping stays on, so
 * "AutoFit Row Height" still shows the whole text; the formula bar always does.
 */
export const DATA_ROW_HEIGHT = 15;

export const DATE_FORMAT = "dd.mm.yyyy";
export const PERCENT_FORMAT = "0.0%";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const cellValue = (value: TableCell, type: TableColumnType | undefined) => {
  if (value !== null && typeof value === "object") {
    return { text: value.text, hyperlink: value.url };
  }
  if (type === "date" && typeof value === "string" && DAY.test(value)) {
    // Midnight UTC: exceljs converts dates to serials in UTC, so this lands on
    // the same calendar day whatever the server's time zone.
    return new Date(`${value}T00:00:00.000Z`);
  }
  if (type === "percent" && typeof value === "number") {
    return value / 100;
  }
  return value;
};

/** A workbook to add sheets to, for exports with more than the one table. */
export const newWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Creștem ONG";
  return workbook;
};

export const renderTableWorkbook = async (table: TableExport): Promise<Buffer> => {
  const workbook = newWorkbook();
  addTableSheet(workbook, table);
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

export const addTableSheet = (
  workbook: ExcelJS.Workbook,
  { sheetName, columns, rows }: TableExport,
): ExcelJS.Worksheet => {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
    // A group's +/− sits on the row it hangs from, above its nested rows.
    properties: { outlineProperties: { summaryBelow: false } } as any,
  });
  sheet.columns = columns.map((column) => ({
    width: column.width,
    style:
      column.type === "date"
        ? { numFmt: DATE_FORMAT, alignment: { horizontal: "left", vertical: "top" } }
        : column.type === "percent"
          ? { numFmt: PERCENT_FORMAT, alignment: { horizontal: "left", vertical: "top" } }
          : column.wrap
          ? { alignment: { wrapText: true, vertical: "top" } }
          : { alignment: { vertical: "top" } },
  }));

  const header = sheet.addRow(columns.map((column) => column.header));
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  for (const row of rows) {
    const cells = Array.isArray(row) ? row : row.cells;
    const added = sheet.addRow(
      cells.map((value, index) => cellValue(value, columns[index]?.type)),
    );
    added.height = DATA_ROW_HEIGHT;
    cells.forEach((value, index) => {
      if (value !== null && typeof value === "object") {
        added.getCell(index + 1).font = LINK_FONT;
      }
    });
    if (!Array.isArray(row) && row.outlineLevel > 0) {
      added.outlineLevel = row.outlineLevel;
    }
  }
  return sheet;
};
