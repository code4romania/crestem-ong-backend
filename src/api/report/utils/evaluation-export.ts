import { DIMENSIONS } from "../../../constants/dimensions";
import { toDateString, toDisplayDate } from "../../../utils/date";
import { isAnonymized } from "../../../utils/anonymize";
import { computeProgress } from "../../evaluation/utils/progress";
import { programsOfReport } from "../../evaluation/utils/admin-list";
import { computeReportScores } from "./scores";

/**
 * The content of the "Descarcă evaluarea" workbook, kept free of `exceljs` so
 * the layout can be tested on plain data. `evaluation-workbook.ts` renders it.
 * Layout follows the client's model `1. Export individual evaluare.xlsx`.
 */

const NOT_AVAILABLE = "NA";
const MISSING = "—";
const DELETED_ACCOUNT = "Cont șters";

/** A percentage the workbook writes as a real number with a `%` format. */
export interface PercentValue {
  percent: number;
}

export type GeneralValue = string | PercentValue;

export interface GeneralRow {
  label: string;
  value: GeneralValue;
}

export interface DimensionResult {
  name: string;
  value: GeneralValue;
}

export interface RespondentColumn {
  label: string;
  email: string;
}

export type RespondentRowKind = "dimension" | "question" | "comment";

export interface RespondentRow {
  kind: RespondentRowKind;
  label: string;
  /** One cell per respondent column; null leaves the cell empty. */
  values: (string | null)[];
}

export interface EvaluationExport {
  fileName: string;
  general: GeneralRow[];
  dimensions: DimensionResult[];
  respondents: RespondentColumn[];
  rows: RespondentRow[];
}

export interface EvaluationExportInput {
  /** The round, with `ong`, `phases.program` and `evaluations.{dimensions.quiz,user}`. */
  report: any;
  /** Whether the round is closed today — `isClosed(report, today)`. */
  closed: boolean;
  admin: { nume?: string | null; email?: string | null; telefon?: string | null } | null;
  /** The experts assigned to the organization in the round's programs. */
  mentorNames: string[];
}

const percent = (value: number | null | undefined): GeneralValue =>
  value == null ? MISSING : { percent: value };

const orMissing = (value: string | null | undefined) =>
  value && value.trim() ? value : MISSING;

const maxOption = (question: (typeof DIMENSIONS)[number]["quiz"][number]) =>
  Math.max(...question.options.map((option) => option.value));

/**
 * `evaluare-<nume-ong>-<YYYY-MM-DD>.xlsx`, ASCII only so the name survives
 * every download path; the date is the round's start.
 */
export const exportFileName = (ongName: string, startDay: string) => {
  const slug =
    (ongName ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ong";
  return `evaluare-${slug}-${startDay}.xlsx`;
};

/**
 * Start and end as the rounds table shows them: the first evaluation phase's
 * span, or creation to closing for an independent round.
 */
const period = (report: any, closed: boolean) => {
  const phase = ((report.phases ?? []) as any[])[0];
  if (phase) {
    return {
      startDay: toDateString(phase.startDate),
      start: toDisplayDate(phase.startDate),
      end: toDisplayDate(phase.endDate),
    };
  }
  const created = new Date(report.createdAt);
  return {
    startDay: toDateString(created),
    start: toDisplayDate(created),
    end: !closed
      ? "în desfășurare"
      : report.finishedAt
        ? toDisplayDate(new Date(report.finishedAt))
        : MISSING,
  };
};

const respondentRows = (evaluations: any[]): RespondentRow[] => {
  const rows: RespondentRow[] = [];
  DIMENSIONS.forEach((dimension, dimensionIndex) => {
    const number = dimensionIndex + 1;
    // Only submitted dimensions count, as in the scores: a draft is not an answer yet.
    const blocks = evaluations.map((evaluation) => {
      const block = ((evaluation.dimensions ?? []) as any[]).find(
        (b) => b.dimensionKey === dimension.key,
      );
      return block?.submitted ? block : null;
    });
    const answerOf = (block: any, questionId: string): number | null => {
      const answer = ((block?.quiz ?? []) as any[]).find(
        (q) => q.questionId === questionId,
      )?.answer;
      return typeof answer === "number" ? answer : null;
    };
    const dimensionMax = dimension.quiz.reduce(
      (sum, question) => sum + maxOption(question),
      0,
    );

    rows.push({
      kind: "dimension",
      label: `${number}. ${dimension.name}`,
      values: blocks.map((block) => {
        if (!block) return null;
        const total = dimension.quiz.reduce(
          (sum, question) => sum + (answerOf(block, question.id) ?? 0),
          0,
        );
        return `${total}/${dimensionMax}`;
      }),
    });
    dimension.quiz.forEach((question, questionIndex) => {
      rows.push({
        kind: "question",
        label: `${number}.${questionIndex + 1}. ${question.question.trim()}`,
        values: blocks.map((block) => {
          const answer = answerOf(block, question.id);
          return answer == null ? null : `${answer}/${maxOption(question)}`;
        }),
      });
    });
    rows.push({
      kind: "comment",
      label: "Argumentare",
      values: blocks.map((block) =>
        block ? orMissing(block.comment) : null,
      ),
    });
  });
  return rows;
};

export const buildEvaluationExport = ({
  report,
  closed,
  admin,
  mentorNames,
}: EvaluationExportInput): EvaluationExport => {
  const evaluations = (report.evaluations ?? []) as any[];
  const scores = computeReportScores(evaluations);
  const completed = evaluations.filter(
    (evaluation) => computeProgress(evaluation.dimensions, closed).complete,
  ).length;
  const programs = programsOfReport(report).map((program) => program.name);
  const { startDay, start, end } = period(report, closed);

  const general: GeneralRow[] = [
    { label: "ID:", value: report.documentId },
    { label: "Nume ONG:", value: orMissing(report.ong?.name) },
    { label: "CIF:", value: orMissing(report.ong?.cui) },
    { label: "Dată început", value: start },
    { label: "Dată final", value: end },
    { label: "Scor obținut", value: percent(scores.overall) },
    { label: "Număr completări", value: `${completed}/${evaluations.length}` },
    {
      label: "Nume persoană de contact organizație:",
      value: orMissing(admin?.nume),
    },
    {
      label: "Email persoană de contact organizație:",
      value: orMissing(admin?.email),
    },
    {
      label: "Telefon persoană de contact organizație",
      value: orMissing(admin?.telefon),
    },
    {
      label: "Program:",
      value: programs.length ? programs.join(", ") : NOT_AVAILABLE,
    },
    {
      label: "Expert alocat (persoană resursă FDSC):",
      value: mentorNames.length ? mentorNames.join(", ") : NOT_AVAILABLE,
    },
  ];

  // Catalog order, as the dimensions appear in the UI.
  const dimensions: DimensionResult[] = DIMENSIONS.map((dimension) => ({
    name: dimension.name,
    value: percent(scores.dimensions[dimension.key]),
  }));

  const respondents: RespondentColumn[] = evaluations.map(
    (evaluation, index) => ({
      label: `Evaluator ${index + 1}`,
      email: isAnonymized(evaluation.user)
        ? DELETED_ACCOUNT
        : orMissing(evaluation.user?.email),
    }),
  );

  return {
    fileName: exportFileName(report.ong?.name, startDay),
    general,
    dimensions,
    respondents,
    rows: respondentRows(evaluations),
  };
};
