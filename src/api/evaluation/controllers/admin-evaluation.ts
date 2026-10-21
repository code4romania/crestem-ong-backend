import { Context } from "koa";
import { pageSlice } from "../../../utils/pagination";
import {
  ADMIN_EVALUATION_POPULATE,
  ADMIN_EVALUATION_SCOPE_QUERY,
  adminEvaluationDbFilters,
  buildAdminEvaluationRows,
  inOrder,
  needsInMemoryPagination,
  paginate,
} from "../utils/admin-list";
import { csvParam, textParam, pageParam } from "../../../utils/query-params";
import { todayInBucharest } from "../../../utils/date";

const PAGE_SIZE = 20;

export default {
  /**
   * The FDSC-wide list of individual responses: one row per respondent per
   * round. The search (respondent name and address, the organization's admin
   * address and fiscal code) and the organization/program scopes reach the
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
      // Cut the page on light rows, then load the answers for the responses on
      // it alone.
      const scope = await strapi
        .documents("api::evaluation.evaluation")
        .findMany({ filters, ...(ADMIN_EVALUATION_SCOPE_QUERY as any) });
      const { data: picked, pagination } = paginate(
        rowsOf(scope),
        page,
        PAGE_SIZE,
      );
      const ids = picked.map((row) => row.documentId);
      const evaluations = ids.length
        ? await strapi.documents("api::evaluation.evaluation").findMany({
            filters: { documentId: { $in: ids } },
            populate: ADMIN_EVALUATION_POPULATE,
          })
        : [];
      const rows = buildAdminEvaluationRows(evaluations as any[], {
        today: todayInBucharest(),
      });
      return { data: inOrder(ids, rows), meta: { pagination } };
    }

    const [evaluations, total] = await Promise.all([
      strapi.documents("api::evaluation.evaluation").findMany({
        filters,
        populate: ADMIN_EVALUATION_POPULATE,
        sort: { createdAt: "desc" },
        ...pageSlice(page, PAGE_SIZE),
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
