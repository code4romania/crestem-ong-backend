export type FileTypeCategory = "image" | "video" | "file";

export function fileTypeCategory(mime: string | null | undefined): FileTypeCategory {
  if (typeof mime !== "string") return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

/**
 * True only for an image ↔ non-image swap. Replacing a video with a document,
 * or one document type with another, is allowed silently — only losing/gaining
 * "this is an image" changes how a block renders.
 */
export function isTypeCategoryMismatch(a: string | null, b: string | null): boolean {
  const aImg = fileTypeCategory(a) === "image";
  const bImg = fileTypeCategory(b) === "image";
  return aImg !== bImg;
}
