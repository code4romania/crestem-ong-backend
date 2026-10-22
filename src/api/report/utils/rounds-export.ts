import { DIMENSIONS } from "../../../constants/dimensions";
import { bucharestDay, toDisplayDate } from "../../../utils/date";
import { isAnonymized } from "../../../utils/anonymize";
import { mentorsAcross } from "../../../utils/ngo-mentors";
import { enrollmentKey } from "../../../utils/program-enrollments";
import type { TableCell, TableColumn, TableRow } from "../../../utils/xlsx-table";
import { computeProgress } from "../../evaluation/utils/progress";
import { isClosed } from "./lifecycle";
import { computeEvaluationScores, computeReportScores } from "./scores";

/**
 * The content of the FDSC rounds exports, one row per round followed by one per
 * respondent, kept apart from the queries so it can be tested on plain data.
 * Two layouts share it: every round ("Evaluări per organizație", the client's
 * model `3. Export Evaluari.xlsx`) and one program's rounds (`4. Export
 * Programe.xlsx`). Cells are filed by column key, so each layout picks its
 * own columns.
 */

const MISSING = "—";
const NOT_AVAILABLE = "N/A";
const INDEPENDENT = "Independentă";
const RETIRED_SUFFIX = " (Retras)";
const DELETED_ACCOUNT = "Cont șters";
const DRAFT_SUFFIX = " (ciornă)";

const PROGRAMS_HEADER = "Program(e)";
const EMAIL_HEADER = "Email reprezentant";

const BASE_COLUMNS: TableColumn[] = [
  { header: "ID evaluare", width: 27 },
  { header: "CIF", width: 14 },
  { header: "Nume ONG", width: 36, wrap: true },
  { header: "Nume reprezentant", width: 24 },
  { header: EMAIL_HEADER, width: 30 },
  { header: "Domeniu principal", width: 22, wrap: true },
  { header: "Domeniu secundar", width: 22, wrap: true },
  { header: PROGRAMS_HEADER, width: 28, wrap: true },
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

const PHONE_COLUMN: TableColumn = { header: "Telefon reprezentant", width: 16 };

const scoreKey = (dimension: (typeof DIMENSIONS)[number]) => `score:${dimension.key}`;
const questionKey = (question: (typeof DIMENSIONS)[number]["quiz"][number]) =>
  `question:${question.id}`;
const commentKey = (dimension: (typeof DIMENSIONS)[number]) => `comment:${dimension.key}`;

const scoreHeader = (dimension: (typeof DIMENSIONS)[number]) =>
  `Scor ${dimension.name} (%)`;
/**
 * Numbered like the questions are ("3.2."): a few indicators share their tag
 * with another in the same dimension, and the number tells them apart.
 */
const questionHeader = (
  question: (typeof DIMENSIONS)[number]["quiz"][number],
  number: string,
) => `Scor ${number}. ${(question.tag ?? question.question).trim()} (%)`;
const commentHeader = (dimension: (typeof DIMENSIONS)[number]) =>
  `Comentarii ${dimension.name}`;

/** A column and the key its cell is filed under. */
export type RoundsColumn = TableColumn & { key: string };

const keyed = (columns: TableColumn[]): RoundsColumn[] =>
  columns.map((column) => ({ ...column, key: column.header }));

/** Per dimension: its score, each indicator's score, then the arguments. */
const DIMENSION_COLUMNS: RoundsColumn[] = DIMENSIONS.flatMap((dimension, dimensionIndex) => [
  {
    key: scoreKey(dimension),
    header: scoreHeader(dimension),
    width: 14,
    type: "percent" as const,
  },
  ...dimension.quiz.map((question, questionIndex) => ({
    key: questionKey(question),
    header: questionHeader(question, `${dimensionIndex + 1}.${questionIndex + 1}`),
    width: 14,
    type: "percent" as const,
  })),
  { key: commentKey(dimension), header: commentHeader(dimension), width: 50, wrap: true },
]);

export const ROUNDS_COLUMNS: RoundsColumn[] = [
  ...keyed(BASE_COLUMNS),
  ...DIMENSION_COLUMNS,
];

/**
 * One program's rounds: no program column, since there is only the one, and the
 * contact's phone right after their email.
 */
export const PROGRAM_ROUNDS_COLUMNS: RoundsColumn[] = [
  ...keyed(
    BASE_COLUMNS.flatMap((column) =>
      column.header === PROGRAMS_HEADER
        ? []
        : column.header === EMAIL_HEADER
          ? [column, PHONE_COLUMN]
          : [column],
    ),
  ),
  ...DIMENSION_COLUMNS,
];

export interface RoundsLayout {
  columns: RoundsColumn[];
  /** Keeps only this program's phases, for the program export. */
  programId?: string;
}

export const ROUNDS_LAYOUT: RoundsLayout = { columns: ROUNDS_COLUMNS };

export const programRoundsLayout = (programId: string): RoundsLayout => ({
  columns: PROGRAM_ROUNDS_COLUMNS,
  programId,
});

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

type Cells = Record<string, TableCell>;

/** A layout's row; a column the cells leave out stays empty. */
const pick = (columns: RoundsColumn[], cells: Cells): TableCell[] =>
  columns.map((column) => cells[column.key] ?? null);

const text = (value: unknown): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || MISSING;
};

const percent = (value: number | null | undefined): TableCell =>
  value == null ? MISSING : value;

/** One line per program, so the three program columns line up row by row. */
const lines = (values: string[]) => (values.length ? values.join("\n") : MISSING);

const sortedPhases = (report: any, programId?: string) =>
  [...((report.phases ?? []) as any[])]
    .filter((phase) => !programId || phase.program?.documentId === programId)
    .sort((a, b) => `${a.startDate ?? ""}`.localeCompare(`${b.startDate ?? ""}`));

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

/** The argument a respondent sent for a dimension; a draft's stays out like its score. */
const submittedComment = (evaluation: any, dimensionKey: string): string | null => {
  const block = ((evaluation.dimensions ?? []) as any[]).find(
    (b) => b.dimensionKey === dimensionKey && b.submitted,
  );
  return typeof block?.comment === "string" && block.comment.trim()
    ? block.comment.trim()
    : null;
};

const dimensionCells = (
  scores: ReturnType<typeof computeReportScores>,
  commentOf: (dimensionKey: string) => string | null,
): Cells => {
  const cells: Cells = {};
  for (const dimension of DIMENSIONS) {
    cells[scoreKey(dimension)] = percent(scores.dimensions[dimension.key]);
    for (const question of dimension.quiz) {
      cells[questionKey(question)] = percent(scores.questions[question.id]);
    }
    cells[commentKey(dimension)] = commentOf(dimension.key) ?? MISSING;
  }
  return cells;
};

/** Completion order; drafts, which have no completion yet, last. */
const byCompletion = (a: any, b: any) => {
  if (a.completedAt && b.completedAt) {
    return `${a.completedAt}`.localeCompare(`${b.completedAt}`);
  }
  if (a.completedAt || b.completedAt) return a.completedAt ? -1 : 1;
  return `${a.createdAt ?? ""}`.localeCompare(`${b.createdAt ?? ""}`);
};

/**
 * One row per respondent who saved anything: their own scores and arguments,
 * named like the per-round export names them. Besides the fiscal code, which
 * keeps them findable when filtering, every organization column stays empty,
 * so the round's row above stands out.
 */
export const respondentRows = (
  evaluations: any[],
  cui: string,
  columns: RoundsColumn[] = ROUNDS_COLUMNS,
): TableCell[][] => {
  let withoutAccount = 0;
  return evaluations
    .filter((evaluation) => (evaluation.dimensions ?? []).length > 0)
    .sort(byCompletion)
    .map((evaluation) => {
      const user = evaluation.user;
      let name: string;
      let email = MISSING;
      let phone = MISSING;
      if (!user) {
        withoutAccount += 1;
        name = `Evaluator ${withoutAccount}`;
      } else if (isAnonymized(user)) {
        name = DELETED_ACCOUNT;
      } else {
        name = text(user.nume);
        email = text(user.email);
        phone = text(user.telefon);
      }
      if (!computeProgress(evaluation.dimensions).complete) {
        name += DRAFT_SUFFIX;
      }
      const scores = computeEvaluationScores(evaluation);
      return pick(columns, {
        "ID evaluare": evaluation.documentId,
        CIF: cui,
        "Nume reprezentant": name,
        [EMAIL_HEADER]: email,
        [PHONE_COLUMN.header]: phone,
        "Scor total obținut (%)": percent(scores.overall),
        ...dimensionCells(scores, (key) => submittedComment(evaluation, key)),
      });
    });
};

export const roundRow = (
  report: any,
  context: RoundsExportContext,
  layout: RoundsLayout = ROUNDS_LAYOUT,
): TableCell[] => {
  const ong = report.ong ?? null;
  const ongId: string | undefined = ong?.documentId;
  const evaluations = (report.evaluations ?? []) as any[];
  const closed = isClosed(report, context.today);
  const scores = computeReportScores(evaluations);
  const completed = evaluations.filter(
    (evaluation) => computeProgress(evaluation.dimensions, closed).complete,
  ).length;
  const admin = ongId ? context.admins.get(ongId) : null;
  const phases = sortedPhases(report, layout.programId);
  const programIds = phases
    .map((phase) => phase.program?.documentId)
    .filter(Boolean) as string[];
  const mentors = programIds.length
    ? mentorsAcross(ongId ? context.mentors.get(ongId) : undefined, programIds)
    : [];

  return pick(layout.columns, {
    "ID evaluare": report.documentId,
    CIF: text(ong?.cui),
    "Nume ONG": `${text(ong?.name)}${ong?.ngoStatus === "deleted" ? RETIRED_SUFFIX : ""}`,
    "Nume reprezentant": text(admin?.nume),
    [EMAIL_HEADER]: text(admin?.email),
    [PHONE_COLUMN.header]: text(admin?.telefon),
    "Domeniu principal": text(ong?.domeniuPrincipal?.name),
    "Domeniu secundar": text(ong?.domeniuSecundar?.name),
    [PROGRAMS_HEADER]: phases.length
      ? lines(phases.map((phase) => text(phase.program?.name)))
      : INDEPENDENT,
    "Fază program": lines(phases.map((phase) => text(phase.title))),
    "Perioada fazei din program": lines(
      phases.map(
        (phase) => `${toDisplayDate(phase.startDate)} – ${toDisplayDate(phase.endDate)}`,
      ),
    ),
    Localitate: text(ong?.localitate?.nume),
    Judet: text(ong?.judet?.nume),
    "Persoană resursă alocată": mentors.length
      ? mentors.map((mentor) => text(mentor.nume)).join(", ")
      : NOT_AVAILABLE,
    "Dată intrare program": enrollmentCell(
      phases.map((phase) => {
        const programId = phase.program?.documentId;
        if (!ongId || !programId) return null;
        return bucharestDay(context.enrollments.get(enrollmentKey(ongId, programId)));
      }),
    ),
    "Dată început evaluare": bucharestDay(report.createdAt) ?? MISSING,
    "Dată final evaluare": lastCompletionDay(evaluations) ?? MISSING,
    "Scor total obținut (%)": percent(scores.overall),
    "Număr de completări": `${completed}/${evaluations.length}`,
    // The arguments live on each respondent's own row below.
    ...dimensionCells(scores, () => null),
  });
};

/** The round's row, then its respondents' rows grouped under it. */
export const roundRows = (
  report: any,
  context: RoundsExportContext,
  layout: RoundsLayout = ROUNDS_LAYOUT,
): TableRow[] => [
  roundRow(report, context, layout),
  ...respondentRows(
    (report.evaluations ?? []) as any[],
    text(report.ong?.cui),
    layout.columns,
  ).map((cells) => ({ cells, outlineLevel: 1 })),
];

export const roundsFileName = (today: string) => `evaluari-${today}.xlsx`;
