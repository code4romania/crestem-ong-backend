export default {
  routes: [
    {
      method: "POST",
      path: "/programs/assign-ong-mentors",
      handler: "program.assignOngMentors",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/programs/remove-ong-mentors",
      handler: "program.removeOngMentors",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
