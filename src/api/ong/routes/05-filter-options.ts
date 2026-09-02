export default {
  routes: [
    {
      method: "GET",
      path: "/admin/filter-options/ongs",
      handler: "filter-options.ongs",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/admin/filter-options/programs",
      handler: "filter-options.programs",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
