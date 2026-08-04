export default {
  routes: [
    {
      method: "GET",
      path: "/reports/current",
      handler: "report.current",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/reports/assign-members",
      handler: "report.assignMembers",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/reports",
      handler: "report.createOne",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "GET",
      path: "/reports/:documentId",
      handler: "report.detail",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "PUT",
      path: "/reports/:documentId",
      handler: "report.updateOne",
      config: { policies: ["global::is-ngo-admin"] },
    },
  ],
};
