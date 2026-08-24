export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/mentors",
      handler: "ong.mentors",
      config: { policies: ["global::is-super-admin-or-ngo-admin"] },
    },
  ],
};
