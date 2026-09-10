export default {
  routes: [
    {
      method: "GET",
      path: "/articles",
      handler: "article.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/articles/:documentId",
      handler: "article.detail",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/articles",
      handler: "article.createOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/articles/:documentId",
      handler: "article.updateOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "DELETE",
      path: "/articles/:documentId",
      handler: "article.deleteOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/articles/:documentId/publish",
      handler: "article.publishOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/articles/:documentId/unpublish",
      handler: "article.unpublishOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
