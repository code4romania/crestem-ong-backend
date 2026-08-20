export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/fdsc-reports",
      handler: "ong.fdscReports",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/:documentId/fdsc-reports",
      handler: "ong.createFdscReport",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
