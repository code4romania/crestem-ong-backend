export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/fdsc-reports",
      handler: "ong.fdscReports",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/ongs/:documentId/fdsc-reports",
      handler: "ong.createFdscReport",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "DELETE",
      path: "/ongs/:documentId/fdsc-reports/:reportDocumentId",
      handler: "ong.deleteFdscReport",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
