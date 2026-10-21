import { DIMENSIONS } from "../../../constants/dimensions";
import { bucharestDay } from "../../../utils/date";
import type { TableCell, TableColumn, TableExport } from "../../../utils/xlsx-table";
import { computeProgress } from "../../evaluation/utils/progress";
import { isClosed } from "../../report/utils/lifecycle";

/**
 * The content of the FDSC organizations list export, kept apart from the
 * queries so it can be tested on plain data. Layout follows the client's model
 * `2. Export Organizații.xlsx`.
 */

const MISSING = "—";
const RETIRED_SUFFIX = " (Retras)";

export const ONG_LIST_COLUMNS: TableColumn[] = [
  { header: "CIF", width: 14 },
  { header: "Nume Organizație", width: 40, wrap: true },
  { header: "Program(e)", width: 30, wrap: true },
  { header: "Dată înregistrare", width: 14, type: "date" },
  { header: "Ultima evaluare", width: 14, type: "date" },
  { header: "Nr. Evaluari", width: 11, type: "number" },
  { header: "Nr. matrici completate", width: 13, type: "number" },
  { header: "Nr. membri organizație", width: 13, type: "number" },
  { header: "Nume Admin", width: 24 },
  { header: "Email Admin", width: 30 },
  { header: "Telefon", width: 15 },
  { header: "Persoana(e) resursa alocata(e)", width: 30, wrap: true },
  { header: "Specializare pe dimensiuni (Mentor)", width: 50, wrap: true },
  { header: "Județ", width: 16 },
  { header: "Localitate", width: 18 },
  { header: "Domeniu principal", width: 24, wrap: true },
  { header: "Domeniu secundar", width: 24, wrap: true },
  { header: "Website", width: 30 },
  { header: "Social Media", width: 40, wrap: true },
];

export interface OngListExportInput {
  /** Organizations in list order, with `judet`, `localitate`, `programs` and both domains. */
  ongs: any[];
  /** `membersByOng`: the admin and the member count of each organization. */
  members: Map<string, { admin: any; memberCount: number }>;
  /** Each organization's rounds, with `phases` and `evaluations.dimensions`. */
  reportsByOng: Map<string, any[]>;
  /** Each organization's assigned mentors, already narrowed to the filtered program. */
  mentorsByOng: Map<string, any[]>;
  /** The program filter, when the list is narrowed to one program. */
  program?: string;
  /** `todayInBucharest()`: closes rounds and dates the file name. */
  today: string;
}

const text = (value: unknown): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || MISSING;
};

/**
 * When the latest finished round closed: its `finishedAt`, or the end of its
 * last phase for a round that closed on its own. Same rule as the overview.
 */
export const lastEvaluationDay = (reports: any[], today: string) =>
  reports
    .filter((report) => isClosed(report, today))
    .map(
      (report) =>
        bucharestDay(report.finishedAt) ??
        ((report.phases ?? []) as any[])
          .map((phase) => bucharestDay(phase.endDate))
          .filter(Boolean)
          .sort()
          .pop() ??
        null,
    )
    .filter(Boolean)
    .sort()
    .pop() ?? null;

const completedEvaluations = (reports: any[], today: string) =>
  reports.reduce(
    (sum, report) =>
      sum +
      ((report.evaluations ?? []) as any[]).filter(
        (evaluation) =>
          computeProgress(evaluation.dimensions, isClosed(report, today))
            .complete,
      ).length,
    0,
  );

const dimensionNames = (keys: unknown) => {
  const chosen = new Set(Array.isArray(keys) ? keys : []);
  return DIMENSIONS.filter((dimension) => chosen.has(dimension.key)).map(
    (dimension) => dimension.name,
  );
};

const ongRow = (ong: any, input: OngListExportInput): TableCell[] => {
  const { admin, memberCount } = input.members.get(ong.documentId) ?? {
    admin: null,
    memberCount: 0,
  };
  const reports = input.reportsByOng.get(ong.documentId) ?? [];
  const mentors = input.mentorsByOng.get(ong.documentId) ?? [];
  const programs = ((ong.programs ?? []) as any[]).filter(
    (program) => !input.program || program.documentId === input.program,
  );
  const lastEvaluation = lastEvaluationDay(reports, input.today);

  return [
    text(ong.cui),
    `${text(ong.name)}${ong.ngoStatus === "deleted" ? RETIRED_SUFFIX : ""}`,
    programs.length
      ? programs.map((program) => program.name).join(", ")
      : MISSING,
    bucharestDay(ong.createdAt) ?? MISSING,
    lastEvaluation ?? MISSING,
    reports.length,
    completedEvaluations(reports, input.today),
    memberCount,
    text(admin?.nume),
    text(admin?.email),
    text(admin?.telefon),
    mentors.length ? mentors.map((mentor) => text(mentor.nume)).join(", ") : MISSING,
    mentors.length
      ? mentors
          .map((mentor) => {
            const names = dimensionNames(mentor.dimensiuni);
            return `${text(mentor.nume)}: ${names.length ? names.join(", ") : MISSING}`;
          })
          .join("\n")
      : MISSING,
    text(ong.judet?.nume),
    text(ong.localitate?.nume),
    text(ong.domeniuPrincipal?.name),
    text(ong.domeniuSecundar?.name),
    text(ong.website),
    text(ong.socialMedia),
  ];
};

export const ongListFileName = (downloadDay: string) =>
  `organizatii-${downloadDay}.xlsx`;

export const buildOngListExport = (
  input: OngListExportInput,
): TableExport & { fileName: string } => ({
  fileName: ongListFileName(input.today),
  sheetName: "Organizații",
  columns: ONG_LIST_COLUMNS,
  rows: input.ongs.map((ong) => ongRow(ong, input)),
});
