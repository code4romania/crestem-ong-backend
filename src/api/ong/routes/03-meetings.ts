export default {
  routes: [
    {
      method: "GET",
      path: "/ongs/:documentId/meetings",
      handler: "ong.meetings",
      config: { policies: ["global::is-fdsc-staff-or-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/:documentId/meetings",
      handler: "ong.createMeeting",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/ongs/:documentId/meetings/:meetingDocumentId",
      handler: "ong.updateMeeting",
      config: { policies: ["global::is-fdsc-staff"] },
    },
  ],
};
