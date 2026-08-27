export default {
  routes: [
    {
      method: "GET",
      path: "/admin/users",
      handler: "admin-user.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/admin/users/:documentId",
      handler: "admin-user.findOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/admin/users/:documentId",
      handler: "admin-user.update",
      // Editing a user account belongs to the administrator: the editor's
      // "Persoane resursă" screen is read-only.
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
