import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { textParam, csvParam, pageParam } from "../../../utils/query-params";
import { createMediaAssetSchema } from "../validation/media-asset";
import { assetCard, assetDetail } from "../utils/view";
import { findPagesUsingFile, findPagesUsingFiles } from "../utils/usage";
import { buildAssetFilters } from "../utils/list-query";

const PAGE_SIZE = 24;

const POPULATE = {
  fisier: true,
  etichete: { fields: ["nume", "slug"] },
  createdBy: { fields: ["firstname", "lastname", "email"] },
} as any;

export default factories.createCoreController(
  "api::media-asset.media-asset",
  ({ strapi }) => ({
    async list(ctx: Context) {
      const search = textParam(ctx.query.search);
      const tip = textParam(ctx.query.tip);
      const slugs = csvParam(ctx.query.etichete);
      const page = pageParam(ctx.query.page);

      const filters = buildAssetFilters({ search, tip, slugs });

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

      // Two queries for the whole page: one batched page lookup keyed by file id,
      // then a count per card from the map.
      const fileIds = [
        ...new Set(
          rows
            .map((row: any) => row.fisier?.id)
            .filter((id: unknown): id is number => typeof id === "number"),
        ),
      ];
      const usageByFile = await findPagesUsingFiles(strapi, fileIds);
      const cards = rows.map((row: any) =>
        assetCard({
          ...row,
          utilizariCount: usageByFile.get(row.fisier?.id)?.length ?? 0,
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
