import { Context } from "koa";
import { csvParam, pageParam, textParam } from "../../../utils/query-params";
import {
  ANSWERED_REPORTS_POPULATE,
  OPTION_SCOPE_POPULATE,
  optionScope,
  type OptionScopeKind,
} from "../utils/filter-scope";

const PAGE_SIZE = 20;

/**
 * The organizations and programs behind the multi-select filters of the FDSC
 * "Evaluări" screen. The list endpoints those screens use elsewhere aggregate
 * members and phases per row; a dropdown that loads page after page as it
 * scrolls needs the name and nothing else.
 *
 * Only the values a row can actually carry are offered: an organization that
 * never ran a round, or a program no round belongs to, would be a choice that
 * matches nothing. Which rounds count depends on the tab asking — see
 * `optionScope`.
 *
 * `selected` carries the ids already picked so their names survive a search that
 * no longer matches them — otherwise a chip would lose its label mid-typing.
 */
const optionsHandler =
  (uid: "api::ong.ong" | "api::program.program") => async (ctx: Context) => {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const search = textParam(ctx.query.search);
    const page = pageParam(ctx.query.page);
    const selected = csvParam(ctx.query.selected);
    const kind: OptionScopeKind =
      textParam(ctx.query.scope) === "reports" ? "reports" : "evaluations";

    const [reports, answered] = await Promise.all([
      strapi.documents("api::report.report").findMany({
        populate: OPTION_SCOPE_POPULATE,
      }),
      // Only the responses tab cares which rounds were answered, and one flat
      // row per response is cheaper than hydrating them under their round.
      kind === "evaluations"
        ? strapi.documents("api::evaluation.evaluation").findMany({
            populate: ANSWERED_REPORTS_POPULATE,
          })
        : Promise.resolve([]),
    ]);
    const answeredReports = new Set(
      (answered as any[])
        .map((evaluation) => evaluation.report?.documentId)
        .filter(Boolean) as string[],
    );
    const scope = optionScope(reports as any[], kind, answeredReports);
    const allowed = [
      ...(uid === "api::ong.ong" ? scope.ongs : scope.programs),
    ];

    const meta = {
      hasIndependent: scope.hasIndependent,
      selected: [] as { documentId: string; name: string }[],
      pagination: { page, pageSize: PAGE_SIZE, pageCount: 1, total: 0 },
    };
    if (allowed.length === 0) {
      return { data: [], meta };
    }

    const filters: Record<string, unknown> = {
      documentId: { $in: allowed },
    };
    if (search) {
      filters.name = { $containsi: search };
    }

    // The uid is a union, so its query types are too; the shapes below are the
    // same for both content-types.
    const documents = strapi.documents(uid) as any;
    const [rows, total, picked] = await Promise.all([
      documents.findMany({
        filters,
        sort: { name: "asc" },
        pagination: { page, pageSize: PAGE_SIZE },
      }),
      documents.count({ filters }),
      selected.length > 0 && page === 1
        ? documents.findMany({ filters: { documentId: { $in: selected } } })
        : Promise.resolve([]),
    ]);

    const view = (row: any) => ({ documentId: row.documentId, name: row.name });
    return {
      data: (rows as any[]).map(view),
      meta: {
        ...meta,
        selected: (picked as any[]).map(view),
        pagination: {
          page,
          pageSize: PAGE_SIZE,
          pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          total,
        },
      },
    };
  };

export default {
  ongs: optionsHandler("api::ong.ong"),
  programs: optionsHandler("api::program.program"),
};
