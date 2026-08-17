export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/joinable",
      handler: "ong.joinable",
      config: {},
    },
    {
      method: "GET",
      path: "/ongs/join-requests",
      handler: "ong.joinRequests",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/join-requests/:documentId/accept",
      handler: "ong.acceptJoinRequest",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/join-requests/:documentId/reject",
      handler: "ong.rejectJoinRequest",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/:documentId/join-requests",
      handler: "ong.createJoinRequest",
      config: {},
    },
  ],
};
