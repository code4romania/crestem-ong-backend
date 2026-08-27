export default {
  routes: [
    {
      method: "GET",
      path: "/programs/:documentId/mentors",
      handler: "program.mentors",
      config: { policies: ["global::is-fdsc-staff-or-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/programs/assign-mentors",
      handler: "program.assignMentors",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "POST",
      path: "/programs/remove-mentors",
      handler: "program.removeMentors",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
