export default {
  routes: [
    {
      method: "GET",
      path: "/mentors/active",
      handler: "mentor.listActive",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
