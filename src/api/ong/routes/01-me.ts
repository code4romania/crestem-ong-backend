export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/me",
      handler: "ong.me",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "PATCH",
      path: "/ongs/me",
      handler: "ong.updateMe",
      config: { policies: ["global::is-ngo-admin"] },
    },
  ],
};
