/**
 * Every authenticated role with a notification feed (FDSC staff, ONG admin,
 * mentor) — scoped to `ctx.state.user` in the controller plus the per-role
 * grant in `ROLE_PERMISSIONS`.
 */
export default {
  routes: [
    {
      method: "GET",
      path: "/notifications",
      handler: "notification.list",
      config: {},
    },
    {
      method: "GET",
      path: "/notifications/unread-count",
      handler: "notification.unreadCount",
      config: {},
    },
    {
      method: "POST",
      path: "/notifications/read-all",
      handler: "notification.markAllRead",
      config: {},
    },
    {
      method: "POST",
      path: "/notifications/:documentId/read",
      handler: "notification.markRead",
      config: {},
    },
  ],
};
