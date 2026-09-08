import type { Core } from "@strapi/strapi";

const TABLE = "pages";

/**
 * Moves pages off Strapi's draft & publish and onto the `stare` enum.
 *
 * It has to run in `register()`, not in `bootstrap()` and not as a file under
 * `database/migrations/`. Disabling draft & publish makes Strapi run this,
 * itself, on the `strapi::content-types.beforeSync` hook:
 *
 *     DELETE FROM pages WHERE published_at IS NULL
 *
 * `beforeSync` fires inside `bootstrap()`, and the migration files run later
 * still, during `db.schema.sync()` — both after the rows are already gone.
 * `register()` is the last point before it.
 *
 * That delete is left to do most of the work, because it does the right thing
 * for a page that has a published version: it drops the draft row and keeps
 * the published one, with its menu relations and media links intact. Draft and
 * published carried the same content anyway — the old controller republished
 * on every update.
 *
 * The one case it gets wrong is a page that was never published, or was
 * withdrawn: that document has a draft row and nothing else, so the delete
 * would take the page with it. Those rows get a `published_at` here purely so
 * the delete no longer matches them. The column is dropped moments later, when
 * the schema syncs without draft & publish.
 *
 * Idempotent, and a no-op on a database that never had draft & publish.
 */
export async function migratePageStare(strapi: Core.Strapi) {
  const knex = strapi.db.connection;

  if (!(await knex.schema.hasTable(TABLE))) return;
  // The column exists once this has run, and `published_at` is gone for good
  // after the first boot without draft & publish. Either means nothing to do.
  if (await knex.schema.hasColumn(TABLE, "stare")) return;
  if (!(await knex.schema.hasColumn(TABLE, "published_at"))) return;

  // Added by hand rather than left to the schema sync, which runs too late to
  // help. The sync finds it already matching `schema.json` and leaves it.
  await knex.schema.alterTable(TABLE, (table) => {
    table.string("stare", 255);
  });

  const publicate = await knex(TABLE)
    .whereNotNull("published_at")
    .update({ stare: "publicat" });

  // Read the ids first instead of using a subquery: an UPDATE that selects
  // from the table it writes is rejected by MySQL, and the database client is
  // configurable here.
  const publishedDocumentIds: string[] = (
    await knex(TABLE).whereNotNull("published_at").distinct("document_id")
  ).map((row: { document_id: string }) => row.document_id);

  const orphanDrafts: number[] = (
    await knex(TABLE)
      .whereNull("published_at")
      .whereNotIn("document_id", publishedDocumentIds)
      .select("id")
  ).map((row: { id: number }) => row.id);

  if (orphanDrafts.length > 0) {
    await knex(TABLE)
      .whereIn("id", orphanDrafts)
      .update({ stare: "schita", published_at: new Date() });
  }

  strapi.log.info(
    `[register] Pagini migrate pe "stare": ${publicate} publicate, ` +
      `${orphanDrafts.length} schițe păstrate.`,
  );
}
