export default {
  routes: [
    {
      method: "GET",
      path: "/contacts",
      handler: "contact.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/contacts/:documentId/status",
      handler: "contact.updateStatus",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "DELETE",
      path: "/contacts/:documentId",
      handler: "contact.remove",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
