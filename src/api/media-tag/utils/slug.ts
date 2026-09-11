/**
 * Strapi's `uid` field type is NOT auto-populated when a row is created through
 * the document service (`documents().create()`), only through the admin Content
 * Manager. The media library creates tags programmatically, so we derive the
 * slug ourselves and store it explicitly.
 *
 * Lowercase, diacritics folded to ASCII, every run of non-alphanumerics
 * collapsed to a single hyphen, no leading/trailing hyphen. Returns `""` when
 * the input carries no slug-able characters (caller decides what to do).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
