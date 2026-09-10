export type FileTypeCategory = "image" | "video" | "file";

export function fileTypeCategory(mime: string | null | undefined): FileTypeCategory {
  if (typeof mime !== "string") return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/heic": "heic",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
};

/**
 * Bare, lowercased extension, no dot. Accepts `".PNG"`, `"a.b.png"`,
 * `"/uploads/x.png"`, `"png"`. `jpeg`/`pjpeg` collapse to `jpg`.
 */
function bareExt(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase().trim();
  const dot = s.lastIndexOf(".");
  if (dot < 0 || dot === s.length - 1) return ""; // no dot, or a trailing dot
  const e = s.slice(dot + 1).replace(/[^a-z0-9]/g, "");
  return e === "jpeg" || e === "pjpeg" ? "jpg" : e;
}

/**
 * The token that identifies a file's format for replace-compatibility.
 *
 * A Media Library replace reuses the same `plugin::upload.file` row and pins
 * the new bytes to the old URL and extension (see `@strapi/upload` →
 * `services/upload.js` `replace()`), so the EXTENSION is what actually can't
 * change. `mime` is only a fallback: `replace()` does update it, which means an
 * earlier bad replace can leave it disagreeing with the extension — so it must
 * never be preferred over the extension when deciding compatibility.
 */
export function formatToken(
  extOrName: string | null | undefined,
  mime: string | null | undefined,
): string {
  return bareExt(extOrName) || MIME_TO_EXT[(mime ?? "").toLowerCase().trim()] || "";
}

/**
 * True when replacing a file whose format token is `current` with one whose
 * token is `incoming` would change the format. When either side is unknown (no
 * extension, unmapped mime) the format can't be judged and the replace is
 * allowed rather than blocked on missing data.
 */
export function isFileFormatMismatch(current: string, incoming: string): boolean {
  if (!current || !incoming) return false;
  return current !== incoming;
}
