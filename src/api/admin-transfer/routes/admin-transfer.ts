const RATE_LIMIT = ["plugin::users-permissions.rateLimit"];

export default {
  routes: [
    // ONG admin — their own organization (US-1, US-2, US-4).
    {
      method: "GET",
      path: "/admin-transfers/current",
      handler: "admin-transfer.current",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/admin-transfers",
      handler: "admin-transfer.create",
      config: { policies: ["global::is-ngo-admin"], middlewares: RATE_LIMIT },
    },
    {
      method: "POST",
      path: "/admin-transfers/:documentId/cancel",
      handler: "admin-transfer.cancel",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/admin-transfers/:documentId/resend",
      handler: "admin-transfer.resend",
      config: { policies: ["global::is-ngo-admin"], middlewares: RATE_LIMIT },
    },

    // FDSC Admin — any organization (US-5). Not `editor-fdsc`.
    {
      method: "GET",
      path: "/ongs/:documentId/admin-transfer",
      handler: "admin-transfer.fdscDetail",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/:documentId/admin-transfer",
      handler: "admin-transfer.fdscCreate",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/:documentId/admin-transfer/cancel",
      handler: "admin-transfer.fdscCancel",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/ongs/:documentId/admin-transfer/resend",
      handler: "admin-transfer.fdscResend",
      config: { policies: ["global::is-super-admin"] },
    },

    // Recipient, signed in: their pending proposal, on the profile (D11).
    {
      method: "GET",
      path: "/admin-transfers/incoming",
      handler: "admin-transfer.incoming",
      config: { policies: ["global::is-ngo-member"] },
    },

    // Recipient (US-3). The token in the body is the credential for the
    // anonymous routes; an existing account must be signed in (BR3).
    {
      method: "POST",
      path: "/admin-transfers/preview",
      handler: "admin-transfer.preview",
      config: { auth: false, middlewares: RATE_LIMIT },
    },
    {
      method: "POST",
      path: "/admin-transfers/accept",
      handler: "admin-transfer.accept",
      config: { middlewares: RATE_LIMIT },
    },
    {
      method: "POST",
      path: "/admin-transfers/decline",
      handler: "admin-transfer.decline",
      config: { middlewares: RATE_LIMIT },
    },
    {
      method: "POST",
      path: "/admin-transfers/accept-new",
      handler: "admin-transfer.acceptNew",
      config: { auth: false, middlewares: RATE_LIMIT },
    },
    {
      method: "POST",
      path: "/admin-transfers/decline-new",
      handler: "admin-transfer.declineNew",
      config: { auth: false, middlewares: RATE_LIMIT },
    },
  ],
};
