export default {
  routes: [
    {
      method: "DELETE",
      path: "/ongs/:documentId",
      handler: "ong.deleteOne",
      // Coarse gate only: it settles *which role* is calling, never *which
      // organization* is theirs. `ong.deleteOne` decides ownership itself,
      // against memberships read from the database — see
      // `src/api/ong/utils/delete-access.ts`.
      config: { policies: ["global::is-fdsc-staff-or-ngo-admin"] },
    },
  ],
};
