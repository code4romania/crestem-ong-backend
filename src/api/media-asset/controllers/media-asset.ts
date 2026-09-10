import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { textParam, csvParam, pageParam } from "../../../utils/query-params";
import {
  createMediaAssetSchema,
  updateMediaAssetSchema,
  cleanupOrphanFileSchema,
} from "../validation/media-asset";
import { assetCard, assetDetail } from "../utils/view";
import { findPagesUsingFile, findPagesUsingFiles } from "../utils/usage";
import { buildAssetFilters } from "../utils/list-query";
import { deleteUploadedFile } from "../../../utils/media";
import { formatToken, isFileFormatMismatch } from "../utils/file-type";

const PAGE_SIZE = 24;

const POPULATE = {
  fisier: true,
  etichete: { fields: ["nume", "slug"] },
  createdBy: { fields: ["firstname", "lastname"] },
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

      const fileId = (row as any).fisier?.id;
      const usage = fileId ? await findPagesUsingFile(strapi, fileId) : [];
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

    async updateOne(ctx: Context) {
      const parsed = updateMediaAssetSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const existing = await strapi.documents("api::media-asset.media-asset").findOne({
        documentId: ctx.params.documentId,
        populate: { fisier: { fields: ["id"] } },
      });
      if (!existing) return ctx.notFound("Fișierul nu există în bibliotecă");

      const { titlu, descriere, eticheteIds, altText } = parsed.data;

      if (eticheteIds?.length) {
        const found = await strapi.db
          .query("api::media-tag.media-tag")
          .findMany({ where: { id: { $in: eticheteIds } }, select: ["id"] });
        if (found.length !== eticheteIds.length) {
          return ctx.badRequest("Una sau mai multe etichete nu există");
        }
      }

      const data: Record<string, unknown> = {};
      if (titlu !== undefined) data.titlu = titlu;
      if (descriere !== undefined) data.descriere = descriere;
      if (eticheteIds !== undefined) data.etichete = eticheteIds;

      if (Object.keys(data).length) {
        await strapi.documents("api::media-asset.media-asset").update({
          documentId: ctx.params.documentId,
          data: data as any,
        });
      }

      if (altText !== undefined && (existing as any).fisier?.id) {
        await strapi.db.query("plugin::upload.file").update({
          where: { id: (existing as any).fisier.id },
          data: { alternativeText: altText },
        });
      }

      const updated = await strapi.documents("api::media-asset.media-asset").findOne({
        documentId: ctx.params.documentId,
        populate: POPULATE,
      });
      const updatedFileId = (updated as any).fisier?.id;
      const usage = updatedFileId
        ? await findPagesUsingFile(strapi, updatedFileId)
        : [];
      return { data: assetDetail(updated, usage) };
    },

    async deleteOne(ctx: Context) {
      const force = textParam(ctx.query.force) === "true";

      const existing = await strapi.documents("api::media-asset.media-asset").findOne({
        documentId: ctx.params.documentId,
        populate: { fisier: true },
      });
      if (!existing) return ctx.notFound("Fișierul nu există în bibliotecă");

      const file = (existing as any).fisier;
      const usage = file?.id ? await findPagesUsingFile(strapi, file.id) : [];

      if (usage.length > 0 && !force) {
        return ctx.conflict("Fișierul este folosit pe una sau mai multe pagini", {
          utilizari: usage,
        });
      }

      await strapi.db.transaction(async () => {
        await strapi.documents("api::media-asset.media-asset").delete({
          documentId: ctx.params.documentId,
        });
        await deleteUploadedFile(strapi, file);
      });

      return { data: { documentId: ctx.params.documentId } };
    },

    async replaceFile(ctx: Context) {
      const existing = await strapi.documents("api::media-asset.media-asset").findOne({
        documentId: ctx.params.documentId,
        populate: { fisier: true },
      });
      if (!existing) return ctx.notFound("Fișierul nu există în bibliotecă");

      const current = (existing as any).fisier;
      if (!current?.id) return ctx.badRequest("Elementul nu are un fișier asociat");

      const uploaded = (ctx.request as any).files?.files;
      const incoming = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      if (!incoming) return ctx.badRequest("Niciun fișier încărcat");

      // A replace reuses the same upload row and URL (Strapi pins the new bytes
      // to the old hash + extension), so a different format would leave the URL
      // serving contents its extension denies and break every block using the
      // asset. Require the same format — compared by extension, since that is
      // what's pinned; `mime` can be left stale by an earlier bad replace.
      const currentFormat = formatToken(current.ext, current.mime);
      const declaredMime =
        incoming.detectedMimeType ??
        (incoming.mimetype && incoming.mimetype !== "application/octet-stream"
          ? incoming.mimetype
          : incoming.type ?? null);
      const incomingFormat = formatToken(
        incoming.originalFilename ?? incoming.name ?? null,
        declaredMime,
      );
      if (isFileFormatMismatch(currentFormat, incomingFormat)) {
        return ctx.conflict(
          `Fișierul nou trebuie să aibă același format ca fișierul curent (${currentFormat.toUpperCase()}). Încarcă un fișier nou în bibliotecă dacă ai nevoie de alt format.`,
        );
      }

      // In-place replace — same plugin::upload.file row id, new bytes.
      // Signature confirmed against @strapi/upload 5.52.3
      // (dist/server/services/upload.js → `async function replace(id, { data, file }, opts)`).
      await strapi
        .plugin("upload")
        .service("upload")
        .replace(current.id, { data: {}, file: incoming });

      const usage = await findPagesUsingFile(strapi, current.id);

      const updated = await strapi.documents("api::media-asset.media-asset").findOne({
        documentId: ctx.params.documentId,
        populate: POPULATE,
      });

      return {
        data: assetDetail(updated, usage),
        meta: { revalidate: usage.map((u) => u.cale) },
      };
    },

    async cleanupOrphanFile(ctx: Context) {
      const parsed = cleanupOrphanFileSchema.safeParse(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const inUse = await strapi.db.query("api::media-asset.media-asset").findOne({
        where: { fisier: parsed.data.fisierId },
        select: ["id"],
      });
      if (inUse) return { data: { deleted: false } };

      const deleted = await strapi.db.transaction(async () => {
        const fileRow = await strapi.db
          .query("plugin::upload.file")
          .findOne({ where: { id: parsed.data.fisierId } });
        if (!fileRow) return false;
        await deleteUploadedFile(strapi, fileRow);
        return true;
      });

      return { data: { deleted } };
    },
  }),
);
