export default {
  routes: [
    {
      method: "GET",
      path: "/counties",
      handler: "judet.list",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/counties/:documentId/cities",
      handler: "judet.cities",
      config: { auth: false },
    },
  ],
};
