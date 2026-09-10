export default {
  routes: [
    {
      method: "GET",
      path: "/library-categories",
      handler: "library-category.tree",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/library-categories",
      handler: "library-category.createOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/library-categories/:documentId",
      handler: "library-category.updateOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "DELETE",
      path: "/library-categories/:documentId",
      handler: "library-category.deleteOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
