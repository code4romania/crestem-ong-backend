/**
 * Deliberately NOT `auth: false`. Visibility depends on who is asking, and with
 * auth disabled Strapi never parses the token — a signed-in NGO admin would
 * arrive as anonymous and every restricted page would vanish for exactly the
 * people entitled to it. The Public role is granted this action in
 * `src/index.ts` instead, which leaves `ctx.state.user` populated when a token
 * is present and null when it is not.
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/public/pages/:slug",
      handler: "page.bySlug",
    },
  ],
};
