export default {
  routes: [
    {
      method: "POST",
      path: "/auth/register/ngo",
      handler: "auth.registerNgo",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/auth/me",
      handler: "auth.me",
      config: {},
    },
    {
      method: "POST",
      path: "/auth/register/individual",
      handler: "auth.registerIndividual",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth/register/mentor",
      handler: "auth.registerMentor",
      // Creating a person, mentor or staff, is the administrator's. An
      // `editor-fdsc` only reads "Persoane resursă".
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/auth/register/mentor/:id/resend",
      handler: "auth.resendMentorInvite",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/auth/register/staff",
      handler: "auth.registerStaff",
      config: { policies: ["global::is-super-admin"] },
    },
    {
      method: "POST",
      path: "/auth/register/member",
      handler: "auth.registerMember",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/auth/register/member/:id/resend",
      handler: "auth.resendMemberInvite",
      config: { policies: ["global::is-ngo-admin"] },
    },
    {
      method: "POST",
      path: "/auth/activate",
      handler: "auth.activate",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth/refresh",
      handler: "auth.refresh",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth/logout",
      handler: "auth.logout",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth/forgot-password",
      handler: "auth.forgotPassword",
      config: { auth: false, middlewares: ["plugin::users-permissions.rateLimit"] },
    },
    {
      method: "POST",
      path: "/auth/reset-password",
      handler: "auth.resetPassword",
      config: { auth: false, middlewares: ["plugin::users-permissions.rateLimit"] },
    },
    {
      method: "POST",
      path: "/auth/change-password",
      handler: "auth.changePassword",
      config: { middlewares: ["plugin::users-permissions.rateLimit"] },
    },
    {
      method: "POST",
      path: "/auth/change-email",
      handler: "auth.requestEmailChange",
      config: { middlewares: ["plugin::users-permissions.rateLimit"] },
    },
    {
      method: "GET",
      path: "/auth/change-email/preview",
      handler: "auth.previewEmailChange",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth/change-email/confirm",
      handler: "auth.confirmEmailChange",
      config: {
        auth: false,
        middlewares: ["plugin::users-permissions.rateLimit"],
      },
    },
    {
      method: "POST",
      path: "/auth/delete-account",
      handler: "auth.deleteAccount",
      config: { middlewares: ["plugin::users-permissions.rateLimit"] },
    },
  ],
};
