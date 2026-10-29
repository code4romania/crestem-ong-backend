export default {
  routes: [
    {
      method: "GET",
      path: "/admin/reports",
      handler: "admin-report.list",
      // Both FDSC accounts read this screen; it carries no write action.
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/admin/reports/export",
      handler: "admin-report.exportList",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    // FDSC Admin only — not `editor-fdsc`, not mentors.
    {
      method: "POST",
      path: "/admin/reports/:documentId/close",
      handler: "admin-report.close",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/admin/reports/:documentId/reopen",
      handler: "admin-report.reopen",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
