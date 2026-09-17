/**
 * Shared across every role with a personal profile page (individual, ONG
 * admin, ONG member) — gated by `ctx.state.user` in the controller plus the
 * per-role grant in `ROLE_PERMISSIONS`, the same way `auth.me` is, rather than
 * a single-role policy like `global::is-individual`.
 */
export default {
  routes: [
    {
      method: "POST",
      path: "/article-reads/mark-read",
      handler: "article-read.markRead",
      config: {},
    },
    {
      method: "GET",
      path: "/article-reads/me",
      handler: "article-read.me",
      config: {},
    },
  ],
};
