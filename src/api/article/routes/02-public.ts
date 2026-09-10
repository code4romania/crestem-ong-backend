/**
 * Deliberately NOT `auth: false`. Visibility depends on who is asking, and with
 * auth disabled Strapi never parses the token — a signed-in NGO admin would
 * arrive as anonymous and every restricted article would vanish for exactly the
 * people entitled to it. The Public role is granted these actions in
 * `src/index.ts` instead, which leaves `ctx.state.user` populated when a token
 * is present and null when it is not.
 *
 * Two distinct literal paths, so registration order does not matter here:
 * `/public/articles` is the filtered, paginated browse list behind a category
 * page, and `/public/articles/by-path` is the single-article read, addressed by
 * its full public path (which carries slashes, so it travels as a query rather
 * than a `:slug` param).
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/public/articles",
      handler: "article.publicList",
    },
    {
      method: "GET",
      path: "/public/articles/by-path",
      handler: "article.publicByPath",
    },
  ],
};
