export default {
  routes: [
    {
      method: "GET",
      path: "/programs/:documentId/ongs",
      handler: "program.ongs",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/programs/assign-ongs",
      handler: "program.assignOngs",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/programs/remove-ongs",
      handler: "program.removeOngs",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
