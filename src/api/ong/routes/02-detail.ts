export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId",
      handler: "ong.detail",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
