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
  ],
};
