export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/evaluations",
      handler: "ong.evaluations",
      config: { policies: ["global::is-fdsc-staff-or-mentor"] },
    },
    {
      method: "GET",
      path: "/ongs/:documentId/evaluations/:reportDocumentId",
      handler: "ong.evaluationDetail",
      config: { policies: ["global::is-fdsc-staff-or-mentor"] },
    },
  ],
};
