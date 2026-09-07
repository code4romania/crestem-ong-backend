export default {
  routes: [
    {
      method: "GET",
      path: "/pages",
      handler: "page.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/pages/:documentId",
      handler: "page.detail",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/pages",
      handler: "page.createOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/pages/:documentId",
      handler: "page.updateOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "DELETE",
      path: "/pages/:documentId",
      handler: "page.deleteOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/pages/:documentId/publish",
      handler: "page.publishOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/pages/:documentId/unpublish",
      handler: "page.unpublishOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
