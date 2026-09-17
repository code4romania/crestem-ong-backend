/**
 * The rules that keep the site's root standing. The homepage is an ordinary
 * page row in everything the editor touches — title, blocks, media, links —
 * and a guarded singleton in everything that could leave `/` broken: it cannot
 * be deleted, withdrawn, emptied, renamed or filed under another page.
 *
 * They live here rather than inline in the controller for the same reason the
 * tree rules do: they are pure, they are the part worth testing, and a
 * controller is a poor place to read a rule from.
 */

export const HOMEPAGE_DELETE_ERROR = "Pagina de start nu poate fi ștearsă";
export const HOMEPAGE_UNPUBLISH_ERROR = "Pagina de start trebuie să rămână publicată";
export const HOMEPAGE_EMPTY_ERROR = "Pagina de start are nevoie de cel puțin un bloc";
export const HOMEPAGE_IMMUTABLE_ERROR =
  "Pagina de start își păstrează slugul, locul în arbore și vizibilitatea publică";

interface StoredPage {
  slug: string;
  esteHomepage?: boolean;
  vizibilitate?: unknown;
}

interface UpdatePayload {
  titlu?: string;
  slug?: string;
  parinte?: string | null;
  vizibilitate?: string[];
  blocuri?: unknown[];
}

export function isHomepage(page: { esteHomepage?: boolean } | null | undefined): boolean {
  return Boolean(page?.esteHomepage);
}

const sameAudiences = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * What the update endpoint must refuse for the homepage, or null when the edit
 * is one an editor is allowed to make: the title and the blocks.
 *
 * A field arriving with the value already stored is not a change, so it
 * passes — the admin form posts the whole record rather than a diff, and
 * refusing it would make every save fail.
 */
export function homepageUpdateError(
  existing: StoredPage,
  payload: UpdatePayload,
): string | null {
  if (!isHomepage(existing)) return null;

  if (payload.blocuri !== undefined && payload.blocuri.length === 0) {
    return HOMEPAGE_EMPTY_ERROR;
  }

  if (payload.slug !== undefined && payload.slug !== existing.slug) {
    return HOMEPAGE_IMMUTABLE_ERROR;
  }

  // An explicit null is "top level", which is where the homepage already sits.
  if (payload.parinte) return HOMEPAGE_IMMUTABLE_ERROR;

  if (payload.vizibilitate !== undefined) {
    const stored = Array.isArray(existing.vizibilitate)
      ? (existing.vizibilitate as string[])
      : ["public"];
    if (!sameAudiences(payload.vizibilitate, stored)) return HOMEPAGE_IMMUTABLE_ERROR;
  }

  return null;
}
