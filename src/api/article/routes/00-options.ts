/**
 * Registered from a file that sorts before `01-crud.ts` so `/articles/options`
 * is matched before `/articles/:documentId`, which would otherwise swallow it
 * and look up an article whose documentId is the literal string "options".
 * Same reason `page/routes/00-options.ts` is named the way it is.
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/articles/options",
      handler: "article.options",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
