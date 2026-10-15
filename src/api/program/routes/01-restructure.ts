export default {
  routes: [
    {
      // Temporary: the October 2026 restructure of SCA and BRD HUB START.
      method: "POST",
      path: "/programs/restructure-2026-10",
      handler: "program-restructure.run",
      config: { policies: ["global::is-super-admin"] },
    },
  ],
};
