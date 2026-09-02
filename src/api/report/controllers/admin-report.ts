import { Context } from "koa";
import {
  ADMIN_REPORT_POPULATE,
  adminReportDbFilters,
  buildAdminReportRows,
  reportNeedsInMemoryPagination,
} from "../utils/admin-report-list";
import { paginate } from "../../evaluation/utils/admin-list";
import { csvParam, pageParam, textParam } from "../../../utils/query-params";
import { todayInBucharest } from "../../../utils/date";

const PAGE_SIZE = 20;

export default {
  /**
   * The FDSC-wide list of rounds: one row per evaluation round an organization
   * ran. The search and the organization/program scopes reach the database; the
   * response statuses, and the program filter once it carries the independent
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
      const reports = await strapi
        .documents("api::report.report")
        .findMany({ filters, populate: ADMIN_REPORT_POPULATE });
      const { data, pagination } = paginate(rowsOf(reports), page, PAGE_SIZE);
      return { data, meta: { pagination } };
    }

    const [reports, total] = await Promise.all([
      strapi.documents("api::report.report").findMany({
        filters,
        populate: ADMIN_REPORT_POPULATE,
        sort: { createdAt: "desc" },
        pagination: { page, pageSize: PAGE_SIZE },
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
};
