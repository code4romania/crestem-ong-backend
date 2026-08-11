export default {
  routes: [
    {
      method: "DELETE",
      path: "/ongs/:documentId",
      handler: "ong.deleteOne",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
