export default {
  routes: [
    {
      method: "GET",
      path: "/programs",
      handler: "program.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/programs/:documentId",
      handler: "program.detail",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/programs/:documentId/stats",
      handler: "program.stats",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/programs",
      handler: "program.createOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/programs/:documentId",
      handler: "program.updateOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "DELETE",
      path: "/programs/:documentId",
      handler: "program.deleteOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
