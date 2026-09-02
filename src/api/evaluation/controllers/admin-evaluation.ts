import { Context } from "koa";
import {
  ADMIN_EVALUATION_POPULATE,
  adminEvaluationDbFilters,
  buildAdminEvaluationRows,
  needsInMemoryPagination,
  paginate,
} from "../utils/admin-list";
import { csvParam, textParam, pageParam } from "../../../utils/query-params";
import { todayInBucharest } from "../../../utils/date";

const PAGE_SIZE = 20;

export default {
  /**
   * The FDSC-wide list of individual responses: one row per respondent per
   * round. The address search and the organization/program scopes reach the
   * database; the status, and the program filter once it carries the
   * independent entry, are derived per row and applied — and paginated — in
   * memory.
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

    const filters = adminEvaluationDbFilters({ search, ongs, programs });
    const rowsOf = (evaluations: unknown[]) =>
      buildAdminEvaluationRows(evaluations as any[], {
        today: todayInBucharest(),
        status,
        programs,
      });

    if (needsInMemoryPagination({ status, programs })) {
      const evaluations = await strapi
        .documents("api::evaluation.evaluation")
        .findMany({ filters, populate: ADMIN_EVALUATION_POPULATE });
      const { data, pagination } = paginate(rowsOf(evaluations), page, PAGE_SIZE);
      return { data, meta: { pagination } };
    }

    const [evaluations, total] = await Promise.all([
      strapi.documents("api::evaluation.evaluation").findMany({
        filters,
        populate: ADMIN_EVALUATION_POPULATE,
        sort: { createdAt: "desc" },
        pagination: { page, pageSize: PAGE_SIZE },
      }),
      strapi.documents("api::evaluation.evaluation").count({ filters }),
    ]);
    return {
      data: rowsOf(evaluations),
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
