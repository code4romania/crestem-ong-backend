/**
 * Registered from a file that sorts before `01-crud.ts` so `/pages/options` is
 * matched before `/pages/:documentId`, which would otherwise swallow it and
 * look up a page whose documentId is the literal string "options".
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/pages/options",
      handler: "page.options",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
