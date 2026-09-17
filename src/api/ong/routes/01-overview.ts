export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/overview",
      handler: "ong.overview",
      config: { policies: ["global::is-fdsc-staff-or-mentor"] },
    },
    {
      method: "GET",
      path: "/ongs/:documentId/library-activity",
      handler: "ong.libraryActivity",
      config: { policies: ["global::is-fdsc-staff-or-mentor"] },
    },
  ],
};
