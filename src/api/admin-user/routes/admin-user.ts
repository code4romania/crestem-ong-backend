export default {
  routes: [
    {
      method: "GET",
      path: "/admin/users",
      handler: "admin-user.list",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      // "Descarcă jurnalul" on "Persoane resursă": read-only, so the editor
      // keeps it.
      method: "GET",
      path: "/admin/meetings/export",
      handler: "admin-user.exportMeetings",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "GET",
      path: "/admin/users/:documentId",
      handler: "admin-user.findOne",
      config: { policies: ["global::is-fdsc-staff"] },
    },
    {
      method: "PUT",
      path: "/admin/users/:documentId",
      handler: "admin-user.update",
      // Editing a user account belongs to the administrator: the editor's
      // "Persoane resursă" screen is read-only.
      config: { policies: ["global::is-super-admin"] },
    },
    // Resend / change email / delete: FDSC Admin only, like the PUT above; the
    // editor stays read-only.
    {
      method: "POST",
      path: "/admin/users/:documentId/resend-invite",
      handler: "admin-user.resendInvite",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/admin/users/:documentId/email",
      handler: "admin-user.changeEmail",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "DELETE",
      path: "/admin/users/:documentId",
      handler: "admin-user.remove",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
