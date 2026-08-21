export default {
  routes: [
    {
      method: "GET",
      path: "/admin/users",
      handler: "admin-user.list",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "GET",
      path: "/admin/users/:documentId",
      handler: "admin-user.findOne",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "PUT",
      path: "/admin/users/:documentId",
      handler: "admin-user.update",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
