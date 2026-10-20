import ExcelJS from "exceljs";

/**
 * A one-sheet table export: bold header row, frozen and filterable, one row per
 * record. The FDSC list exports share it; the per-round evaluation export has
 * its own two-sheet layout in `report/utils/evaluation-workbook.ts`.
 */

export type TableColumnType = "text" | "number" | "date";

export interface TableColumn {
  header: string;
  width: number;
  /**
   * `date` cells take a `YYYY-MM-DD` calendar day and become real Excel dates;
   * any other string in them (e.g. "—") is written as text.
   */
  type?: TableColumnType;
  /** Multi-line cells, e.g. one entry per line. */
  wrap?: boolean;
}

export type TableCell = string | number | null;

export interface TableExport {
  sheetName: string;
  columns: TableColumn[];
  rows: TableCell[][];
}

export const DATE_FORMAT = "dd.mm.yyyy";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const cellValue = (value: TableCell, type: TableColumnType | undefined) => {
  if (type === "date" && typeof value === "string" && DAY.test(value)) {
    // Midnight UTC: exceljs converts dates to serials in UTC, so this lands on
    // the same calendar day whatever the server's time zone.
    return new Date(`${value}T00:00:00.000Z`);
  }
  return value;
};

export const renderTableWorkbook = async ({
  sheetName,
  columns,
  rows,
}: TableExport): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Creștem ONG";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map((column) => ({
    width: column.width,
    style:
      column.type === "date"
        ? { numFmt: DATE_FORMAT, alignment: { horizontal: "left" } }
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
    sheet.addRow(row.map((value, index) => cellValue(value, columns[index]?.type)));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
};
