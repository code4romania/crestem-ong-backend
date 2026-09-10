/**
 * Deliberately NOT `auth: false`. The counts depend on who is asking — a
 * signed-in NGO admin sees articles restricted to their audience — and with
 * auth disabled Strapi never parses the token, so that visitor would arrive as
 * anonymous and be undercounted. The Public role is granted this action in
 * `src/index.ts` instead, which leaves `ctx.state.user` populated when a token
 * is present and null when it is not.
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/public/library-categories",
      handler: "library-category.publicTree",
    },
  ],
};
