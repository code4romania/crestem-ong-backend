export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId",
      handler: "ong.detail",
      config: { policies: ["global::is-fdsc-staff-or-ngo-admin-or-mentor"] },
    },
  ],
};
