export default {
  routes: [
    {
      method: "GET",
      path: "/me/ongs",
      handler: "evaluation.myOngs",
      config: {},
    },
    {
      method: "GET",
      path: "/evaluations/ong/:ongDocumentId",
      handler: "evaluation.myEvaluations",
      config: { policies: ["global::is-ngo-member"] },
    },
    {
      method: "GET",
      path: "/evaluations/current",
      handler: "evaluation.current",
      config: { policies: ["global::is-ngo-member"] },
    },
    {
      method: "GET",
      path: "/evaluations/:documentId",
      handler: "evaluation.detail",
      config: { policies: ["global::is-ngo-member"] },
    },
    {
      method: "PUT",
      path: "/evaluations/:documentId",
      handler: "evaluation.updateOne",
      config: { policies: ["global::is-ngo-member"] },
    },
  ],
};
