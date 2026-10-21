import { DIMENSIONS } from "../../../constants/dimensions";
import { bucharestDay, toDisplayDate } from "../../../utils/date";
import { mentorsAcross } from "../../../utils/ngo-mentors";
import { enrollmentKey } from "../../../utils/program-enrollments";
import type { TableCell, TableColumn } from "../../../utils/xlsx-table";
import { computeProgress } from "../../evaluation/utils/progress";
import { isClosed } from "./lifecycle";
import { computeReportScores } from "./scores";

/**
 * The content of the FDSC rounds export ("Evaluări per organizație"), one row
 * per round, kept apart from the queries so it can be tested on plain data.
 * Layout follows the client's model `3. Export Evaluari.xlsx`.
 */

const MISSING = "—";
const NOT_AVAILABLE = "N/A";
const INDEPENDENT = "Independentă";
const RETIRED_SUFFIX = " (Retras)";

const BASE_COLUMNS: TableColumn[] = [
  { header: "ID evaluare", width: 27 },
  { header: "CIF", width: 14 },
  { header: "Nume ONG", width: 36, wrap: true },
  { header: "Nume reprezentant", width: 24 },
  { header: "Email reprezentant", width: 30 },
  { header: "Domeniu principal", width: 22, wrap: true },
  { header: "Domeniu secundar", width: 22, wrap: true },
  { header: "Program(e)", width: 28, wrap: true },
  { header: "Fază program", width: 22, wrap: true },
  { header: "Perioada fazei din program", width: 25, wrap: true },
  { header: "Localitate", width: 18 },
  { header: "Judet", width: 16 },
  { header: "Persoană resursă alocată", width: 28, wrap: true },
  { header: "Dată intrare program", width: 14, type: "date", wrap: true },
  { header: "Dată început evaluare", width: 14, type: "date" },
  { header: "Dată final evaluare", width: 14, type: "date" },
  { header: "Scor total obținut (%)", width: 12, type: "percent" },
  { header: "Număr de completări", width: 12 },
];

/** Per dimension: its score, each indicator's score, then the arguments. */
const DIMENSION_COLUMNS: TableColumn[] = DIMENSIONS.flatMap((dimension) => [
  { header: `Scor ${dimension.name} (%)`, width: 14, type: "percent" as const },
  ...dimension.quiz.map((question) => ({
    header: `Scor ${(question.tag ?? question.question).trim()} (%)`,
    width: 14,
    type: "percent" as const,
  })),
  { header: `Comentarii ${dimension.name}`, width: 50, wrap: true },
]);

export const ROUNDS_COLUMNS: TableColumn[] = [...BASE_COLUMNS, ...DIMENSION_COLUMNS];

export interface RoundsExportContext {
  /** The organization admin ("reprezentant") per organization. */
  admins: Map<string, any>;
  /** `assignedMentorsByOng`: mentors per organization and program. */
  mentors: Map<string, Map<string, any[]>>;
  /** `enrollmentDates`: when each organization joined each program. */
  enrollments: Map<string, string>;
  /** `todayInBucharest()`. */
  today: string;
}

const text = (value: unknown): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || MISSING;
};

const percent = (value: number | null | undefined): TableCell =>
  value == null ? MISSING : value;

/** One line per program, so the three program columns line up row by row. */
const lines = (values: string[]) => (values.length ? values.join("\n") : MISSING);

const sortedPhases = (report: any) =>
  [...((report.phases ?? []) as any[])].sort((a, b) =>
    `${a.startDate ?? ""}`.localeCompare(`${b.startDate ?? ""}`),
  );

/** When the last respondent finished; it moves on as later respondents finish. */
const lastCompletionDay = (evaluations: any[]) =>
  evaluations
    .map((evaluation) => bucharestDay(evaluation.completedAt))
    .filter(Boolean)
    .sort()
    .pop() ?? null;

/**
 * A single date stays a real Excel date; several (one per program) can only be
 * text, one per line like the program column.
 */
const enrollmentCell = (days: (string | null)[]): TableCell => {
  if (days.length === 0) return MISSING;
  if (days.length === 1) return days[0] ?? MISSING;
  return days.map((day) => (day ? toDisplayDate(day) : MISSING)).join("\n");
};

const dimensionCells = (scores: ReturnType<typeof computeReportScores>, evaluations: any[]) =>
  DIMENSIONS.flatMap((dimension) => {
    // Every argument sent for this dimension, one per line; drafts stay out like
    // they do from the scores.
    const comments = evaluations
      .map((evaluation) =>
        ((evaluation.dimensions ?? []) as any[]).find(
          (block) => block.dimensionKey === dimension.key && block.submitted,
        ),
      )
      .map((block) => (typeof block?.comment === "string" ? block.comment.trim() : ""))
      .filter(Boolean);
    return [
      percent(scores.dimensions[dimension.key]),
      ...dimension.quiz.map((question) => percent(scores.questions[question.id])),
      comments.length ? comments.join("\n") : MISSING,
    ];
  });

export const roundRow = (report: any, context: RoundsExportContext): TableCell[] => {
  const ong = report.ong ?? null;
  const ongId: string | undefined = ong?.documentId;
  const evaluations = (report.evaluations ?? []) as any[];
  const closed = isClosed(report, context.today);
  const scores = computeReportScores(evaluations);
  const completed = evaluations.filter(
    (evaluation) => computeProgress(evaluation.dimensions, closed).complete,
  ).length;
  const admin = ongId ? context.admins.get(ongId) : null;
  const phases = sortedPhases(report);
  const programIds = phases
    .map((phase) => phase.program?.documentId)
    .filter(Boolean) as string[];
  const mentors = programIds.length
    ? mentorsAcross(ongId ? context.mentors.get(ongId) : undefined, programIds)
    : [];

  return [
    report.documentId,
    text(ong?.cui),
    `${text(ong?.name)}${ong?.ngoStatus === "deleted" ? RETIRED_SUFFIX : ""}`,
    text(admin?.nume),
    text(admin?.email),
    text(ong?.domeniuPrincipal?.name),
    text(ong?.domeniuSecundar?.name),
    phases.length ? lines(phases.map((phase) => text(phase.program?.name))) : INDEPENDENT,
    lines(phases.map((phase) => text(phase.title))),
    lines(
      phases.map(
        (phase) => `${toDisplayDate(phase.startDate)} – ${toDisplayDate(phase.endDate)}`,
      ),
    ),
    text(ong?.localitate?.nume),
    text(ong?.judet?.nume),
    mentors.length ? mentors.map((mentor) => text(mentor.nume)).join(", ") : NOT_AVAILABLE,
    enrollmentCell(
      phases.map((phase) => {
        const programId = phase.program?.documentId;
        if (!ongId || !programId) return null;
        return bucharestDay(context.enrollments.get(enrollmentKey(ongId, programId)));
      }),
    ),
    bucharestDay(report.createdAt) ?? MISSING,
    lastCompletionDay(evaluations) ?? MISSING,
    percent(scores.overall),
    `${completed}/${evaluations.length}`,
    ...dimensionCells(scores, evaluations),
  ];
};

export const roundsFileName = (today: string) => `evaluari-${today}.xlsx`;
