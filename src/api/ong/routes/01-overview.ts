export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/overview",
      handler: "ong.overview",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
