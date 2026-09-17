export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/names",
      handler: "ong.listNames",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
