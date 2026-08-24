export default {
  routes: [
    {
      method: "GET",
      path: "/activity-types",
      handler: "activity-type.list",
      config: { policies: ["global::is-super-admin-or-ngo-admin"] },
    },
  ],
};
