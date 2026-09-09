import { fileTypeCategory } from "./file-type";
import type { PageUsage } from "./usage";

export interface AssetFileDTO {
  id: number;
  url: string;
  name: string;
  mime: string | null;
  ext: string | null;
  size: number | null;
  alternativeText: string | null;
  width: number | null;
  height: number | null;
}

export interface MediaAssetCardDTO {
  documentId: string;
  titlu: string;
  fisier: AssetFileDTO;
  tip: "image" | "video" | "file";
  etichete: { id: number; documentId: string; nume: string; slug: string }[];
  utilizariCount: number;
}

export interface MediaAssetDetailDTO extends MediaAssetCardDTO {
  descriere: string;
  altText: string;
  adaugatDe: string;
  adaugatLa: string | null;
  utilizari: PageUsage[];
}

const fileDto = (f: any): AssetFileDTO => ({
  id: f?.id ?? 0,
  url: f?.url ?? "",
  name: f?.name ?? "",
  mime: f?.mime ?? null,
  ext: f?.ext ?? null,
  size: f?.size ?? null,
  alternativeText: f?.alternativeText ?? null,
  width: f?.width ?? null,
  height: f?.height ?? null,
});

const tagDtos = (tags: any): { id: number; documentId: string; nume: string; slug: string }[] =>
  Array.isArray(tags)
    ? tags.map((t) => ({ id: t.id, documentId: t.documentId, nume: t.nume, slug: t.slug }))
    : [];

const uploaderName = (createdBy: any): string => {
  if (!createdBy) return "—";
  const full = [createdBy.firstname, createdBy.lastname].filter(Boolean).join(" ").trim();
  return full || "—";
};

export function assetCard(row: any): MediaAssetCardDTO {
  return {
    documentId: row.documentId,
    titlu: row.titlu,
    fisier: fileDto(row.fisier),
    tip: fileTypeCategory(row.fisier?.mime),
    etichete: tagDtos(row.etichete),
    utilizariCount: typeof row.utilizariCount === "number" ? row.utilizariCount : 0,
  };
}

export function assetDetail(row: any, usage: PageUsage[]): MediaAssetDetailDTO {
  return {
    ...assetCard({ ...row, utilizariCount: usage.length }),
    descriere: row.descriere ?? "",
    altText: row.fisier?.alternativeText ?? "",
    adaugatDe: uploaderName(row.createdBy),
    adaugatLa: row.createdAt ?? null,
    utilizari: usage,
  };
}
