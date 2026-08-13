export default {
  routes: [
    {
      method: "GET",
      path: "/mentor/conversations",
      handler: "conversation.listForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "GET",
      path: "/mentor/conversations/:documentId/messages",
      handler: "conversation.messagesForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "POST",
      path: "/mentor/conversations/:documentId/messages",
      handler: "conversation.sendMessageForMentor",
      config: { policies: ["global::is-mentor"] },
    },
  ],
};
