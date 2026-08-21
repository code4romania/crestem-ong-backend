export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/meetings",
      handler: "ong.meetings",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
