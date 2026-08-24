/**
 * Deletion of uploaded media that carries personal data (BR-26).
 *
 * Nulling a media relation only detaches it: the file stays on the provider at
 * a stable URL — usually under a filename containing the person's name — and,
 * once the relation is gone, can no longer be located to be purged later. The
 * file therefore has to be removed explicitly, before the relation is cleared.
 */

const FILE_MODEL_UID = "plugin::upload.file";

export interface UploadedFileRef {
  id?: number | string;
  provider?: string;
  formats?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/**
 * Removes the provider objects behind one uploaded file: the original plus
 * every generated format (thumbnail, small, medium, large).
 *
 * This is the provider half of
 * `strapi.plugin("upload").service("upload").remove`, reproduced — including
 * its guard. A row whose `provider` is not the configured one was written by a
 * provider this instance no longer has, cannot be reached, and is left on the
 * old storage exactly as the plugin leaves it.
 */
async function deleteProviderObjects(
  strapi: any,
  file: UploadedFileRef,
): Promise<void> {
  const configuredProvider = strapi.config.get("plugin::upload")?.provider;
  if (file.provider !== configuredProvider) return;
  const upload = strapi.plugin("upload");
  await upload.provider.delete(file);
  for (const format of Object.values(file.formats ?? {})) {
    if (format) {
      await upload.provider.delete(format);
    }
  }
}

/**
 * Removes one uploaded file from the provider and from the media library.
 *
 * The two halves are run separately, rather than as one `upload.remove(file)`
 * call behind one `try`, because only one of them may be swallowed:
 *
 * - **Provider / filesystem — tolerated.** A file that is already gone (deleted
 *   by hand, lost by the provider, never written) must not abort the account or
 *   organization deletion around it. In practice the common case never reaches
 *   the catch: the local provider resolves for a missing path rather than
 *   throwing. The catch is there for permission, network and remote-storage
 *   failures. The `plugin::upload.file` row still goes, so the deletion is not
 *   left holding a reference to media it can no longer purge.
 * - **`plugin::upload.file` row — NOT tolerated.** Both callers run inside
 *   `strapi.db.transaction`. On Postgres a failed statement aborts the whole
 *   transaction, so swallowing this error means the *next* write dies with a
 *   generic "current transaction is aborted" while the real cause is visible
 *   only in a `console.error` — the deletion fails loudly but misdiagnosed.
 *   Letting it propagate rolls the transaction back with its actual error.
 *
 * The distinction is structural — which call is inside the `try` — not a match
 * on error text, so it cannot drift with driver or provider wording.
 *
 * Trade-off: the upload plugin's `media.delete` event is not emitted on this
 * path. Nothing in this codebase subscribes to it; an admin-configured webhook
 * on media deletion would not fire for programmatic account/ONG deletion.
 */
export async function deleteUploadedFile(
  strapi: any,
  file: UploadedFileRef | null | undefined,
): Promise<void> {
  if (!file?.id) return;
  try {
    await deleteProviderObjects(strapi, file);
  } catch (error) {
    console.error("uploaded file removal failed", { id: file.id, error });
  }
  await strapi.db.query(FILE_MODEL_UID).delete({ where: { id: file.id } });
}
