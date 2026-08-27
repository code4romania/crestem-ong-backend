export default {
  routes: [
    {
      method: "GET",
      path: "/mentors/me",
      handler: "mentor.me",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "PATCH",
      path: "/mentors/me",
      handler: "mentor.updateMe",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "GET",
      path: "/mentors/active",
      handler: "mentor.listActive",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
