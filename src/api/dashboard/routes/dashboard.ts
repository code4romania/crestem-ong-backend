export default {
  routes: [
    {
      method: "GET",
      path: "/dashboard/fdsc",
      handler: "dashboard.fdsc",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/dashboard/ong",
      handler: "dashboard.ong",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "GET",
      path: "/dashboard/mentor",
      handler: "dashboard.mentor",
      config: { policies: ["global::is-mentor"] },
    },
  ],
};
