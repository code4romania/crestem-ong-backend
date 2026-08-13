export default {
  routes: [
    {
      method: "GET",
      path: "/conversations",
      handler: "conversation.list",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "GET",
      path: "/conversations/:documentId/messages",
      handler: "conversation.messages",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/conversations/:documentId/messages",
      handler: "conversation.sendMessage",
      config: { policies: ["global::is-ngo-admin"] },
    },
  ],
};
