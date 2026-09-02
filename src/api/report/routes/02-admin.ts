export default {
  routes: [
    {
      method: "GET",
      path: "/admin/reports",
      handler: "admin-report.list",
      // Both FDSC accounts read this screen; it carries no write action.
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
