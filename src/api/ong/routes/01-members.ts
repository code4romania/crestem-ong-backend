export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/members",
      handler: "ong.members",
      config: { policies: ["global::is-ngo-admin"] },
    },
  ],
};
