export default {
  routes: [
    {
      method: "GET",
      path: "/people-directory/programs",
      handler: "public-person.programs",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/people-directory",
      handler: "public-person.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
