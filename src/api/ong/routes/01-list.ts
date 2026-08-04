export default {
  routes: [
    {
      method: "GET",
      path: "/ongs",
      handler: "ong.list",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
