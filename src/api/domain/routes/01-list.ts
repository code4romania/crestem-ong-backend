export default {
  routes: [
    {
      method: "GET",
      path: "/domains",
      handler: "domain.list",
      config: { auth: false },
    },
  ],
};
