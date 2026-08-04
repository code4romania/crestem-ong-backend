export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/active",
      handler: "ong.listActive",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
