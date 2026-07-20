export default {
  routes: [
    {
      method: "POST",
      path: "/auth/register/ngo",
      handler: "auth.registerNgo",
      config: { auth: false },
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
      path: "/auth/mentor/activate",
      handler: "auth.activateMentor",
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
  ],
};
