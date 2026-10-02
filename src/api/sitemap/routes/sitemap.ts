/**
 * `auth: false` on purpose, unlike `/public/pages`: the sitemap is the same list
 * for everyone — what an anonymous visitor may open — so there is no token to
 * parse and no entry needed in the permission matrix in `src/index.ts`.
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/public/sitemap",
      handler: "sitemap.list",
      config: { auth: false },
    },
  ],
};
