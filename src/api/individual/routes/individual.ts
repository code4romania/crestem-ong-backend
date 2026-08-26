export default {
  routes: [
    {
      method: "GET",
      path: "/individuals/me",
      handler: "individual.me",
      config: { policies: ["global::is-individual"] },
    },
    {
      method: "PATCH",
      path: "/individuals/me",
      handler: "individual.updateMe",
      config: { policies: ["global::is-individual"] },
    },
  ],
};
