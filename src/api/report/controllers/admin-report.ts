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
import { addTableRow, startTableSheet, streamWorkbook } from "../../../utils/xlsx-table";
import { ROUNDS_COLUMNS, roundRows, roundsFileName } from "../utils/rounds-export";
import { forEachExportRound } from "../utils/rounds-export-loader";

const PAGE_SIZE = 20;

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
   * The rounds are picked on light rows, then read with their answers a batch
   * at a time and streamed out as they come, so memory stays flat however
   * many there are.
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

    const fileName = roundsFileName(today);
    ctx.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    ctx.set("Content-Disposition", `attachment; filename="${fileName}"`);
    ctx.body = streamWorkbook(async (workbook) => {
      const sheet = startTableSheet(workbook, {
        sheetName: "Evaluări",
        columns: ROUNDS_COLUMNS,
      });
      await forEachExportRound(strapi, ids, today, (report, context) => {
        for (const row of roundRows(report, context)) {
          addTableRow(sheet, ROUNDS_COLUMNS, row);
        }
      });
    });
  },
};
