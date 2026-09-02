import { Context } from "koa";
import { csvParam, pageParam, textParam } from "../../../utils/query-params";

const PAGE_SIZE = 20;

/**
 * The organizations and programs behind the multi-select filters of the FDSC
 * "Evaluări" screen. The list endpoints those screens use elsewhere aggregate
 * members and phases per row; a dropdown that loads page after page as it
 * scrolls needs the name and nothing else.
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

    const filters: Record<string, unknown> = {};
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
