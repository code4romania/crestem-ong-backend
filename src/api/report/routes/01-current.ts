export default {
  routes: [
    {
      method: "GET",
      path: "/reports",
      handler: "report.list",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "GET",
      path: "/reports/current",
      handler: "report.current",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/reports/start",
      handler: "report.start",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "GET",
      path: "/reports/:documentId",
      handler: "report.detail",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "GET",
      path: "/reports/:documentId/members",
      handler: "report.members",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/reports/:documentId/members",
      handler: "report.addMembers",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/reports/:documentId/finish",
      handler: "report.finishOne",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "DELETE",
      path: "/reports/:documentId",
      handler: "report.deleteOne",
      config: { policies: ["global::is-ngo-admin"] },
    },
  ],
};
