import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { textParam, csvParam, pageParam } from "../../../utils/query-params";
import { createMediaAssetSchema } from "../validation/media-asset";
import { assetCard, assetDetail } from "../utils/view";
import { findPagesUsingFile } from "../utils/usage";

const PAGE_SIZE = 24;

const POPULATE = {
  fisier: true,
  etichete: { fields: ["nume", "slug"] },
  createdBy: { fields: ["firstname", "lastname", "email"] },
} as any;

const tipFilter = (tip: string) => {
  if (tip === "image") return { fisier: { mime: { $startsWith: "image/" } } };
  if (tip === "video") return { fisier: { mime: { $startsWith: "video/" } } };
  if (tip === "file")
    return {
      $and: [
        { fisier: { mime: { $notContains: "image/" } } },
        { fisier: { mime: { $notContains: "video/" } } },
      ],
    };
  return {};
};

export default factories.createCoreController(
  "api::media-asset.media-asset",
  ({ strapi }) => ({
    async list(ctx: Context) {
      const search = textParam(ctx.query.search);
      const tip = textParam(ctx.query.tip);
      const slugs = csvParam(ctx.query.etichete);
      const page = pageParam(ctx.query.page);

      const filters: Record<string, unknown> = { $and: [] as unknown[] };
      const and = filters.$and as unknown[];
      if (search) {
        and.push({
          $or: [
            { titlu: { $containsi: search } },
            { fisier: { name: { $containsi: search } } },
          ],
        });
      }
      if (tip) and.push(tipFilter(tip));
      if (slugs.length) and.push({ etichete: { slug: { $in: slugs } } });
      if (and.length === 0) delete filters.$and;

      const [rows, total] = await Promise.all([
        strapi.documents("api::media-asset.media-asset").findMany({
          filters,
          populate: POPULATE,
          sort: { createdAt: "desc" },
          limit: PAGE_SIZE,
          start: (page - 1) * PAGE_SIZE,
        }),
        strapi.documents("api::media-asset.media-asset").count({ filters }),
      ]);

      // One usage count per card. The page table is small; N short queries are
      // acceptable at library scale (hundreds of assets, 24 per page).
      const cards = await Promise.all(
        rows.map(async (row: any) => {
          const usage = await findPagesUsingFile(strapi, row.fisier?.id);
          return assetCard({ ...row, utilizariCount: usage.length });
        }),
      );

      return {
        data: cards,
        meta: {
          pagination: {
            page,
            pageSize: PAGE_SIZE,
            total,
            pageCount: Math.ceil(total / PAGE_SIZE),
          },
        },
      };
    },

    async detail(ctx: Context) {
      const row = await strapi.documents("api::media-asset.media-asset").findOne({
        documentId: ctx.params.documentId,
        populate: POPULATE,
      });
      if (!row) return ctx.notFound("Fișierul nu există în bibliotecă");

      const usage = await findPagesUsingFile(strapi, (row as any).fisier?.id);
      return { data: assetDetail(row, usage) };
    },

    async createOne(ctx: Context) {
      const parsed = createMediaAssetSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }
      const { fisierId, titlu, descriere, eticheteIds = [] } = parsed.data;

      const file = await strapi.db
        .query("plugin::upload.file")
        .findOne({ where: { id: fisierId } });
      if (!file) return ctx.notFound("Fișierul încărcat nu a fost găsit");

      const existing = await strapi.documents("api::media-asset.media-asset").findFirst({
        filters: { fisier: { id: { $in: [fisierId] } } },
      });
      if (existing) return ctx.conflict("Fișierul este deja în bibliotecă");

      if (eticheteIds.length) {
        const found = await strapi.db
          .query("api::media-tag.media-tag")
          .findMany({ where: { id: { $in: eticheteIds } }, select: ["id"] });
        if (found.length !== eticheteIds.length) {
          return ctx.badRequest("Una sau mai multe etichete nu există");
        }
      }

      const created = await strapi.documents("api::media-asset.media-asset").create({
        data: {
          titlu,
          descriere: descriere ?? null,
          fisier: fisierId,
          etichete: eticheteIds,
        } as any,
        populate: POPULATE,
      });

      return { data: assetDetail(created, []) };
    },
  }),
);
