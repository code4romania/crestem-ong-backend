export default {
  routes: [
    {
      method: "GET",
      path: "/admin/evaluations",
      handler: "admin-evaluation.list",
      // Both FDSC accounts read this screen; it carries no write action.
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
