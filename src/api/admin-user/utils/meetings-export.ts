import { DIMENSIONS } from "../../../constants/dimensions";
import { isAnonymized } from "../../../utils/anonymize";
import { bucharestDay } from "../../../utils/date";
import type { TableCell, TableColumn } from "../../../utils/xlsx-table";
import { fileSlug } from "../../report/utils/evaluation-export";

/**
 * The content of "Descarcă jurnalul" on "Persoane resursă": one row per meeting
 * held, after the client's model `5. Export Jurnal de Activitate.xlsx`, kept
 * apart from the queries so it can be tested on plain data.
 */

const MISSING = "—";
const RETIRED_SUFFIX = " (Retras)";
const DELETED_ACCOUNT = "Cont șters";

/** Only meetings that took place belong in the activity journal. */
export const HELD_STATUS = "efectuata";

/**
 * The `details.reason` of the 404 sent when no meeting matches, so the screen
 * can tell "nothing to download" from a real failure.
 */
export const EMPTY_EXPORT = "empty";

const FORMATS: Record<string, string> = {
  online: "Online",
  fata_in_fata: "Față în față",
};

export const MEETINGS_COLUMNS: TableColumn[] = [
  { header: "Organizația", width: 36, wrap: true },
  { header: "CIF", width: 14 },
  { header: "Persoană resursă", width: 24 },
  { header: "Program", width: 28, wrap: true },
  { header: "Subiect întâlnire", width: 36, wrap: true },
  { header: "Dată", width: 12, type: "date" },
  { header: "Ora", width: 8 },
  { header: "Format", width: 14 },
  { header: "Dimensiuni matrice", width: 30, wrap: true },
  { header: "Comentarii adiționale", width: 50, wrap: true },
  { header: "Raport încărcat", width: 30 },
];

const text = (value: unknown): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || MISSING;
};

/** The hour in Bucharest, as the meeting was scheduled ("14:30"). */
const bucharestTime = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("ro-RO", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** The dimension names, one per line, in the matrix's order. */
const dimensionLines = (keys: unknown): string => {
  const chosen = new Set(Array.isArray(keys) ? keys : []);
  const names = DIMENSIONS.filter((dimension) => chosen.has(dimension.key)).map(
    (dimension) => dimension.name,
  );
  return names.length ? names.join("\n") : MISSING;
};

/**
 * `mediaBase` makes a relative upload URL absolute (the local provider stores
 * `/uploads/…`; S3 URLs already are), so the link opens from Excel.
 */
const reportCell = (report: any, mediaBase: string): TableCell => {
  if (!report?.url) return MISSING;
  const url = /^https?:\/\//.test(report.url) ? report.url : `${mediaBase}${report.url}`;
  return { text: text(report.name), url };
};

export const meetingRow = (meeting: any, mediaBase: string): TableCell[] => {
  const ong = meeting.ong ?? null;
  const mentor = meeting.mentor ?? null;
  return [
    ong ? `${text(ong.name)}${ong.ngoStatus === "deleted" ? RETIRED_SUFFIX : ""}` : MISSING,
    text(ong?.cui),
    !mentor ? MISSING : isAnonymized(mentor) ? DELETED_ACCOUNT : text(mentor.nume),
    text(meeting.program?.name),
    text(meeting.subiect),
    bucharestDay(meeting.dataOra) ?? MISSING,
    bucharestTime(meeting.dataOra) ?? MISSING,
    FORMATS[meeting.format] ?? MISSING,
    dimensionLines(meeting.dimensiuni),
    text(meeting.comentarii),
    reportCell(meeting.report, mediaBase),
  ];
};

/**
 * `jurnal-activitate-<YYYY-MM-DD>.xlsx`, or with the resource person's name
 * for one person's journal; dated by the download day.
 */
export const meetingsFileName = (today: string, mentorName?: string) =>
  mentorName === undefined
    ? `jurnal-activitate-${today}.xlsx`
    : `jurnal-activitate-${fileSlug(mentorName, "persoana-resursa")}-${today}.xlsx`;
