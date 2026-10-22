import { Context } from "koa";
import { pageSlice } from "../../../utils/pagination";
import {
  ADMIN_REPORT_POPULATE,
  ADMIN_REPORT_SCOPE_QUERY,
  adminReportDbFilters,
  buildAdminReportRows,
  reportNeedsInMemoryPagination,
} from "../utils/admin-report-list";
import { inOrder, paginate } from "../../evaluation/utils/admin-list";
import { csvParam, pageParam, textParam } from "../../../utils/query-params";
import { todayInBucharest } from "../../../utils/date";
import { getOngAdmins } from "../../../utils/ong-scope";
import { assignedMentorsByOng } from "../../../utils/ngo-mentors";
import { enrollmentDates } from "../../../utils/program-enrollments";
import { renderTableWorkbook, type TableRow } from "../../../utils/xlsx-table";
import { ROUNDS_COLUMNS, roundRows, roundsFileName } from "../utils/rounds-export";

const PAGE_SIZE = 20;

/** Rounds read with their answers at a time by the export, to keep memory flat. */
const EXPORT_BATCH_SIZE = 50;

/** What a row of the export reads, on top of the round itself. */
const ROUNDS_EXPORT_POPULATE = {
  ong: {
    populate: {
      judet: true,
      localitate: true,
      domeniuPrincipal: true,
      domeniuSecundar: true,
    },
  },
  phases: { populate: { program: true } },
  evaluations: {
    populate: {
      dimensions: { populate: { quiz: true } },
      user: true,
    },
  },
} as const;

export default {
  /**
   * The FDSC-wide list of rounds: one row per evaluation round an organization
   * ran. The search (organization name and fiscal code, its admin's address and
   * its respondents' addresses) and the organization/program scopes reach the
   * database; the round status, and the program filter once it carries the independent
   * entry, are derived and applied — and paginated — in memory.
   */
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const search = textParam(ctx.query.search);
    const ongs = csvParam(ctx.query.ongs);
    const programs = csvParam(ctx.query.programs);
    const status = textParam(ctx.query.status);
    const page = pageParam(ctx.query.page);

    const filters = adminReportDbFilters({ search, ongs, programs });
    const rowsOf = (reports: unknown[]) =>
      buildAdminReportRows(reports as any[], {
        today: todayInBucharest(),
        status,
        programs,
      });

    if (reportNeedsInMemoryPagination({ status, programs })) {
      // Cut the page on light rows, then load respondents and answers for the
      // rounds on it alone.
      const scope = await strapi
        .documents("api::report.report")
        .findMany({ filters, ...(ADMIN_REPORT_SCOPE_QUERY as any) });
      const { data: picked, pagination } = paginate(
        rowsOf(scope),
        page,
        PAGE_SIZE,
      );
      const ids = picked.map((row) => row.documentId);
      const reports = ids.length
        ? await strapi.documents("api::report.report").findMany({
            filters: { documentId: { $in: ids } },
            populate: ADMIN_REPORT_POPULATE,
          })
        : [];
      const rows = buildAdminReportRows(reports as any[], {
        today: todayInBucharest(),
      });
      return { data: inOrder(ids, rows), meta: { pagination } };
    }

    const [reports, total] = await Promise.all([
      strapi.documents("api::report.report").findMany({
        filters,
        populate: ADMIN_REPORT_POPULATE,
        sort: { createdAt: "desc" },
        ...pageSlice(page, PAGE_SIZE),
      }),
      strapi.documents("api::report.report").count({ filters }),
    ]);
    return {
      data: rowsOf(reports),
      meta: {
        pagination: {
          page,
          pageSize: PAGE_SIZE,
          pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          total,
        },
      },
    };
  },

  /**
   * "Descarcă lista" on the rounds tab: every round its filters match, in the
   * list's order, as an `.xlsx`, each followed by its respondents' own rows.
   * The rounds are picked on light rows, then read
   * with their answers a batch at a time, so memory stays flat however many
   * there are.
   */
  async exportList(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const search = textParam(ctx.query.search);
    const ongs = csvParam(ctx.query.ongs);
    const programs = csvParam(ctx.query.programs);
    const status = textParam(ctx.query.status);
    const today = todayInBucharest();

    const scope = await strapi.documents("api::report.report").findMany({
      filters: adminReportDbFilters({ search, ongs, programs }),
      ...(ADMIN_REPORT_SCOPE_QUERY as any),
    });
    const ids = buildAdminReportRows(scope as any[], {
      today,
      status,
      programs,
    }).map((row) => row.documentId);

    const rows: TableRow[] = [];
    for (let start = 0; start < ids.length; start += EXPORT_BATCH_SIZE) {
      const batch = ids.slice(start, start + EXPORT_BATCH_SIZE);
      const reports = (await strapi.documents("api::report.report").findMany({
        filters: { documentId: { $in: batch } },
        populate: ROUNDS_EXPORT_POPULATE,
      })) as any[];
      const ongIds = [
        ...new Set(
          reports.map((report) => report.ong?.documentId).filter(Boolean),
        ),
      ] as string[];
      const [admins, mentors, enrollments] = await Promise.all([
        getOngAdmins(strapi, ongIds),
        assignedMentorsByOng(strapi, ongIds),
        enrollmentDates(strapi, ongIds),
      ]);
      for (const report of inOrder(batch, reports)) {
        rows.push(...roundRows(report, { admins, mentors, enrollments, today }));
      }
    }

    const fileName = roundsFileName(today);
    ctx.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    ctx.set("Content-Disposition", `attachment; filename="${fileName}"`);
    ctx.body = await renderTableWorkbook({
      sheetName: "Evaluări",
      columns: ROUNDS_COLUMNS,
      rows,
    });
  },
};
