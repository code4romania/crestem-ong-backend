export default {
  routes: [
    {
      method: "GET",
      path: "/dimensions",
      handler: "dimension.find",
      config: { auth: false },
    },
  ],
};
