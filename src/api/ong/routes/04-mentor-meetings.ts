export default {
  routes: [
    {
      method: "GET",
      path: "/mentor/ongs",
      handler: "ong.ongsForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "GET",
      path: "/mentor/programs",
      handler: "ong.programsForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "GET",
      path: "/mentor/meetings",
      handler: "ong.meetingsForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "POST",
      path: "/mentor/meetings",
      handler: "ong.createMeetingForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "PUT",
      path: "/mentor/meetings/:meetingDocumentId",
      handler: "ong.updateMeetingForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "POST",
      path: "/mentor/meetings/:meetingDocumentId/cancel",
      handler: "ong.cancelMeetingForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "POST",
      path: "/mentor/meetings/:meetingDocumentId/complete",
      handler: "ong.completeMeetingForMentor",
      config: { policies: ["global::is-mentor"] },
    },
    {
      method: "POST",
      path: "/mentor/meetings/:meetingDocumentId/report",
      handler: "ong.uploadMeetingReportForMentor",
      config: { policies: ["global::is-mentor"] },
    },
  ],
};
