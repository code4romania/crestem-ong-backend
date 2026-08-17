export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/members",
      handler: "ong.members",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "DELETE",
      path: "/ongs/members/:documentId",
      handler: "ong.removeMember",
      config: { policies: ["global::is-ngo-admin"] },
    },
  ],
};
